var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');
var logic = require('./logic.js');
var port = 3000;

server.listen(port, function(){
	console.log('Server listening at port %d', port);
});

app.use(express.static(__dirname + '/public'));

//call logic to assign statements to everyone
//receive a summary to send to everyone in room
function getAndSendStatements(roomName){
	var result = logic.getStatements(roomName);
	io.to(roomName).emit('getstatements',result);
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
		}
	});

	//data is the requested room name
	socket.on('createroom', function(data){
		var result = logic.createRoom(socket.username,data);
		socket.emit('createresult',result);
		var thename = result.name;
		if(result.success){
			//join the socket.io room
			socket.join(thename);
			io.emit('roomdata',logic.getAllRoomData());
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
	socket.on('requestjoin', function(data){
		var result = logic.joinRequest(socket.username,data);
		if (result.success){
			//join socket.io room
			socket.join(data);
			//tell everyone in same room to update display
			io.to(data).emit('updatecurrentroom',logic.getPlayersIn(data));
			io.emit('roomdata',logic.getAllRoomData());
		}
		socket.emit('joinresult',result);
	});

	//data isn't necessary 
	socket.on('requestleave', function(data){
		var result = logic.leaveRequest(socket.username);
		if (result.success){
			socket.leave(result.theRoom);
			//tell everyone else in room to update list
			if(!result.roomDeleted){
				io.to(result.theRoom).emit('updatecurrentroom',logic.getPlayersIn(result.theRoom));
			}
			io.emit('roomdata',logic.getAllRoomData());
		}
		socket.emit('leaveresult',result);
	});

	//data isn't necessary
	socket.on('requeststart', function(data){
		var result = logic.startRequest(socket.username);
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
		}
		else{
			socket.emit('votefailed',result.message);
		}
	});

	socket.on('disconnect', function(data){
		var result = logic.disconnect(socket.username);
		if(result.success && !result.roomDeleted){
			io.to(result.theRoom).emit('updatecurrentroom',logic.getPlayersIn(result.theRoom));
		}
		io.emit('roomdata',logic.getAllRoomData());
	});
});
