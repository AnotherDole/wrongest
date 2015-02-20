var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var logic = require('./logic.js');
var port = process.env.OPENSHIFT_NODEJS_PORT || 3000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var server_address = process.env.OPENSHIFT_APP_DNS || ('localhost:'+port);

/************** Variables for testing **********/
var connected = 0,playing=0;
var testRoom = '';
var testing = false;
if(process.argv[2] == 'test'){
	testing = true;
	console.log('Server started in test mode.');
}
/************** End testing variables *********/


server.listen(port,server_ip_address, function(){
	console.log('Server listening on ' + server_ip_address + ' on port ' + port);
});

app.use(express.static(__dirname + '/public'));
app.get('/:id',function(req,res){
	if(logic.roomExists(req.params.id)){
	//	res.location('../'+req.params.id);
		res.sendFile(__dirname + '/public/index.html');
	}
	else{
		res.redirect('../error.html');
	}
});

//call logic to assign statements to everyone
//receive a summary to send to everyone in room
//Or declare a winner
function getAndSendStatements(roomName){
	var result = logic.getStatements(roomName);
	if(result == false){
		result = logic.getWinner(roomName);
		io.to(roomName).emit('gameover',result);
	}
	else{
		io.to(roomName).emit('getstatements',result);
	}
}

//Common code for when a player leaves or disconnects
function leaveOrDisconnect(result){
	if(result.roomDeleted || result.fromWaiting) return;

	var playerList = logic.getPlayersIn(result.theRoom);
	if(!result.duringGame){
		io.to(result.theRoom).emit('updatecurrentroom',playerList.players,playerList.leader,playerList.dealer);
		return;
	}
	if(playerList.players.length <= 2){
		logic.pauseGame(result.theRoom);
		io.to(result.theRoom).emit('pausegame');
		//this is necessary because waiting players may have been added
		var newList = logic.getPlayersIn(result.theRoom);
		io.to(result.theRoom).emit('updatecurrentroom',newList.players,newList.leader,newList.dealer);
		return;
	}
	io.to(result.theRoom).emit('updatecurrentroom', playerList.players, playerList.leader, playerList.dealer);
	/*
	var newOrder = logic.getOrder(result.theRoom);
	io.to(result.theRoom).emit('roundorder',newOrder.order,newOrder.dealer);
	*/
	if(result.newNeeded == 0){
		logic.prepareForVotes(result.theRoom);
	}
	io.to(result.theRoom).emit('newdefendcount',result.newNeeded);
	if(result.duringVote){
		//For now, just call for a new vote
		logic.prepareForVotes(result.theRoom);
		io.to(result.theRoom).emit('newdefendcount',0);
	}
}

io.on('connection', function (socket){
	//data is the requested room name
	socket.on('createroom', function(playerName){
		var result = logic.createRoom(playerName, socket.id);
		if(result.success){
			//join the socket.io room
			socket.username = result.playerName;
			socket.roomName = result.roomName;
			socket.join(result.roomName);
			result.link = 'http://' + server_address + '/' + result.roomName;
			socket.emit('createresult',result);
			socket.emit('deckdata',logic.getDeckData());
			var blar = logic.getPlayersIn(result.roomName);
			io.to(result.roomName).emit('updatecurrentroom',blar.players,blar.leader,blar.dealer);
		}
	});

	socket.on('requestroomdata', function(roomName){
		var result = logic.getPlayersIn(roomName);
		socket.emit('updatecurrentroom',result.players,result.leader,result.dealer);
	});

	// data is requested room name
	socket.on('requestjoin', function(playerName,roomName){
		var result = logic.joinRequest(playerName, socket.id, roomName);
		if (result.success){
			if(!result.waiting){
				//join socket.io room
				socket.join(roomName);
				//tell everyone in same room to update display
				var blar = logic.getPlayersIn(roomName);
				io.to(roomName).emit('updatecurrentroom',blar.players,blar.leader,blar.dealer);
			}
			//socket.emit('deckdata',logic.getDeckData());
			socket.username = playerName;
			socket.roomName = roomName;
			result.link = 'http://' + server_address + '/' + result.roomName;
		}
		socket.emit('joinresult',result);
	});

	//data isn't necessary 
	socket.on('requestleave', function(data){
		var result = logic.leaveRequest(socket.username,socket.roomName);
		if (result){
			socket.leave(socket.roomName);
			delete socket.username;
			delete socket.roomName;
			leaveOrDisconnect(result);
		}
		socket.emit('leaveresult',result);
	});

	//request to start a game with certain options
	socket.on('requeststart', function(deckName, time, allowRedraw, dealerFirstOrLast){
		var options = {deckName: deckName, time: time, allowRedraw: allowRedraw, dealerFirstOrLast: dealerFirstOrLast};
		var result = logic.startRequest(socket.username,socket.roomName,options);
		socket.emit('startresult',result);
		//time to start game, send out the first statements
		if(result.success){
			getAndSendStatements(socket.roomName);
			var order = logic.adjustOrder(socket.roomName);
			io.to(socket.roomName).emit('updatecurrentroom',order.players,order.leader,order.dealer);
		}
	});

	socket.on('makedefend', function(){
		var result = logic.getWhosUp(socket.roomName, socket.username);
		if(result){
			io.to(socket.roomName).emit('timetodefend',result.player,result.time);
		}
	});

	socket.on('donedefending', function(data){
		var result = logic.doneDefending(socket.roomName, socket.username);
		if(result.success){
			//tell everyone in room new votesNeeded
			io.to(socket.roomName).emit('newdefendcount',result.votesNeeded);
			if(result.votesNeeded <= 0){
				logic.prepareForVotes(socket.roomName);
			}
		}
		else{
			//tell specific user they are stupid
			socket.emit('donefailed', result.message);
		}
	});

	socket.on('playervotes',function(most,least){
		var result = logic.processVote(socket.roomName,socket.username,most,least);
		if (result.success){
			//tell everyone in room about vote
			io.to(socket.roomName).emit('receivevote',result);
			if(result.votesNeeded == 0){
				result = logic.endRound(socket.roomName);
				//add players from the waiting list
				if(result.socketsToAdd.length > 0){
					for(var i = 0; i < result.socketsToAdd.length; i++){
						io.sockets.connected[result.socketsToAdd[i]].join(socket.roomName);
					}
					var blar = logic.getPlayersIn(socket.roomName);
					io.to(socket.roomName).emit('updatecurrentroom',blar.players,blar.leader,blar.dealer);
				}
				delete result.socketsToAdd;
				io.to(socket.roomName).emit('roundend',result);
				getAndSendStatements(socket.roomName);
				var order = logic.adjustOrder(socket.roomName);
				io.to(socket.roomName).emit('updatecurrentroom',order.players,order.leader,order.dealer);
			}
		}
		else{
			socket.emit('votefailed',result.message);
		}
	});

	socket.on('restartgame', function(data){
		var result = logic.canRestartGame(socket.username,socket.roomName);
		if(result){
			var order = logic.adjustOrder(socket.roomName);
			io.to(socket.roomName).emit('updatecurrentroom',order.players,order.leader,order.dealer);
			io.to(socket.roomName).emit('newdefendcount',order.players.length);
			getAndSendStatements(socket.roomName);
		}
	});

	socket.on('disconnect', function(data){
		var result = logic.leaveRequest(socket.username,socket.roomName);
		if(result && !result.roomDeleted){
			//io.to(result.theRoom).emit('updatecurrentroom',logic.getPlayersIn(result.theRoom));
			leaveOrDisconnect(result);
		}
		if(testing) playing--;
	});

/****************** Begin code for testing *************/
	if(testing){
		connected++;
		playing++;
		if(playing == 1){
			var result = logic.createRoom('Player1',socket.id);
			socket.emit('createresult',result);
			testRoom = result.roomName;
			socket.username = 'Player1';
			socket.roomName = testRoom;
			socket.emit('deckdata',logic.getDeckData());
			socket.join(testRoom);
			var blar = logic.getPlayersIn(testRoom);
			io.to(testRoom).emit('updatecurrentroom',blar.players,blar.leader,blar.dealer);
		}	
		else{
			socket.emit('joinresult',logic.joinRequest('Player'+connected,socket.id,testRoom));
			socket.username='Player'+connected;
			socket.roomName = testRoom;
			socket.emit('deckdata',logic.getDeckData());
			socket.join(testRoom);
			var blar = logic.getPlayersIn(testRoom);
			io.to(testRoom).emit('updatecurrentroom',blar.players,blar.leader,blar.dealer);
		}
	}
/***************** End code for testing ***************/
});
