var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var logic = require('./logic.js');
var port = process.env.OPENSHIFT_NODEJS_PORT || 3000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

/************** Variables for testing **********/
var connected = 0,playing=0;
var testRoom = 'Test Room';
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

	io.to(result.theRoom).emit('updatecurrentroom',logic.getPlayersIn(result.theRoom));
	if(result.duringGame){
		var newOrder = logic.getOrder(result.theRoom);
		io.to(result.theRoom).emit('roundorder',newOrder.order,newOrder.dealer);
	}
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
	socket.on('createroom', function(playerName,roomName,password){
		var result = logic.createRoom(playerName, socket.id, roomName, password);
		socket.emit('createresult',result);
		if(result.success){
			//join the socket.io room
			socket.username = result.playerName;
			socket.roomName = result.roomName;
			socket.join(result.roomName);
			socket.emit('deckdata',logic.getDeckData());
			io.to(result.roomName).emit('updatecurrentroom',logic.getPlayersIn(result.roomName));
		}
	});

	// data isn't necessary
	socket.on('requestroomdata', function(data){
		var result = logic.getAllRoomData();
		socket.emit('roomdata',result);
	});

	// data is requested room name
	socket.on('requestjoin', function(playerName,roomName,password){
		var result = logic.joinRequest(playerName, socket.id, roomName, password);
		if (result.success){
			if(!result.waiting){
				//join socket.io room
				socket.join(roomName);
				//tell everyone in same room to update display
				io.to(roomName).emit('updatecurrentroom',logic.getPlayersIn(roomName));
			}
			socket.emit('deckdata',logic.getDeckData());
			socket.username = playerName;
			socket.roomName = roomName;
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
			io.to(socket.roomName).emit('roundorder',order['order'],order['dealer']);
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
					io.to(socket.roomName).emit('updatecurrentroom',logic.getPlayersIn(socket.roomName));
				}
				delete result.socketsToAdd;
				io.to(socket.roomName).emit('roundend',result);
				getAndSendStatements(socket.roomName);
				var order = logic.adjustOrder(socket.roomName);
				io.to(socket.roomName).emit('roundorder',order.order,order.dealer);
			}
		}
		else{
			socket.emit('votefailed',result.message);
		}
	});

	socket.on('disconnect', function(data){
		var result = logic.leaveRequest(socket.username,socket.roomName);
		if(result && !result.roomDeleted){
			io.to(result.theRoom).emit('updatecurrentroom',logic.getPlayersIn(result.theRoom));
			leaveOrDisconnect(result);
		}
		if(testing) playing--;
	});

/****************** Begin code for testing *************/
	if(testing){
		connected++;
		playing++;
		if(playing == 1){
			socket.emit('createresult',logic.createRoom('Player1',socket.id,testRoom,''));
			socket.username = 'Player1';
			socket.roomName = testRoom;
			socket.emit('deckdata',logic.getDeckData());
			socket.join(testRoom);
			io.to(testRoom).emit('updatecurrentroom',logic.getPlayersIn(testRoom));
		}	
		else{
			socket.emit('joinresult',logic.joinRequest('Player'+connected,socket.id,testRoom,''));
			socket.username='Player'+connected;
			socket.roomName = testRoom;
			socket.emit('deckdata',logic.getDeckData());
			socket.join(testRoom);
			io.to(testRoom).emit('updatecurrentroom',logic.getPlayersIn(testRoom));
		}
	}
/***************** End code for testing ***************/
});
