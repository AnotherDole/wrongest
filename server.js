var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var logic = require('./logic.js');
var port = process.env.OPENSHIFT_NODEJS_PORT || 3000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

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
	//tell everyone else in room to update list
	if(!result.roomDeleted){
		io.to(result.theRoom).emit('updatecurrentroom',logic.getPlayersIn(result.theRoom));
	}
	if(result.duringArg){
		if(result.newNeeded == 0){
			logic.prepareForVotes(result.theRoom);
		}
		io.to(result.theRoom).emit('newdefendcount',result.newNeeded);
	}
	else if(result.duringVote){
		//For now, just call for a new vote
		logic.prepareForVotes(result.theRoom);
		io.to(result.theRoom).emit('newdefendcount',0);
	}
}

io.on('connection', function (socket){
	//data is requested username
	socket.on('logon', function(data){
		if(socket.username != null){
			socket.emit('logonresult',{success:false,message:"You have already chosen a name."});
		}
		else{
			var result = logic.addPlayer(data,socket.id);
			if(result.success){
				socket.username = result.name;
			}
			socket.emit('logonresult',result);
			socket.emit('deckdata',logic.getDeckData());
		}
	});

	//data is the requested room name
	socket.on('createroom', function(data,password){
		var result = logic.createRoom(socket.username,data,password);
		socket.emit('createresult',result);
		var thename = result.name;
		if(result.success){
			//join the socket.io room
			socket.join(thename);
		}
		//tell that person to update room display
		io.to(thename).emit('updatecurrentroom',logic.getPlayersIn(thename));
	});

	// data isn't necessary
	socket.on('requestroomdata', function(data){
		var result = logic.getAllRoomData();
		socket.emit('roomdata',result);
	});

	// data is requested room name
	socket.on('requestjoin', function(data,password){
		var result = logic.joinRequest(socket.username,data,password);
		if (result.success){
			//join socket.io room
			socket.join(data);
			//tell everyone in same room to update display
			io.to(data).emit('updatecurrentroom',logic.getPlayersIn(data));
		}
		socket.emit('joinresult',result);
	});

	//data isn't necessary 
	socket.on('requestleave', function(data){
		var result = logic.leaveRequest(socket.username);
		if (result.success){
			socket.leave(result.theRoom);
			leaveOrDisconnect(result);
		}
		socket.emit('leaveresult',result);
	});

	//data is deck name 
	socket.on('requeststart', function(data){
		var result = logic.startRequest(socket.username,data);
		socket.emit('startresult',result);
		//time to start game, send out the first statements
		if(result.success){
			getAndSendStatements(result.theRoom);
		}
	});

	socket.on('donedefending', function(data){
		var result = logic.doneDefending(socket.username);
		if(result.success){
			//tell everyone in room new votesNeeded
			io.to(result.roomName).emit('newdefendcount',result.votesNeeded);
			if(result.votesNeeded <= 0){
				logic.prepareForVotes(result.roomName);
			}
		}
		else{
			//tell specific user they are stupid
			socket.emit('donefailed', result.message);
		}
	});

	socket.on('playervotes',function(data){
		var most = data.most, least = data.least;
		var result = logic.processVote(socket.username,most,least);
		if (result.success){
			//tell everyone in room about vote
			io.to(result.roomName).emit('receivevote',result);
			if(result.votesNeeded == 0){
				var roomName = result.roomName;
				result = logic.endRound(roomName);
				io.to(roomName).emit('roundend',result);
				getAndSendStatements(roomName);
			}
		}
		else{
			socket.emit('votefailed',result.message);
		}
	});

	socket.on('disconnect', function(data){
		var result = logic.disconnect(socket.username);
		if(result.success && !result.roomDeleted){
			io.to(result.theRoom).emit('updatecurrentroom',logic.getPlayersIn(result.theRoom));
			leaveOrDisconnect(result);
		}
	});
});
