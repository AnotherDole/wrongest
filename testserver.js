var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');
var logic = require('./logic.js');
var port = 3000;

var gameOver = false;

server.listen(port, function(){
	console.log('Server listening at port %d', port);
});

app.use(express.static(__dirname + '/public'));

//Call logic to assign statements to everyone
//Receive a summary to send to everyone in room
//Or declare a winner
function getAndSendStatements(roomName){
	var result = logic.getStatements(roomName);
	if(result == false){
		gameOver = true;
		result = logic.getWinner(roomName);
		io.to(roomName).emit('gameover',result);
		console.log("Game over, restart server to try again.");
	}
	else{
		io.to(roomName).emit('getstatements',result);
	}
}

io.on('connection', function (socket){
	socket.username='Player1';
	socket.emit('logonresult',logic.addPlayer('Player1',socket.id));
	socket.emit('createresult',logic.createRoom('Player1','Test Room'));
	socket.join('Test Room');
	logic.addPlayer('WillieDangDoodle','1');
	logic.joinRequest('WillieDangDoodle','Test Room');
	logic.addPlayer('Varzandeh','2');
	logic.joinRequest('Varzandeh','Test Room');
	logic.addPlayer('Matt Crow','3');
	logic.joinRequest('Matt Crow','Test Room');
	io.to('Test Room').emit('updatecurrentroom',logic.getPlayersIn('Test Room'));
	logic.startRequest('Player1','Mini Deck');
	getAndSendStatements('Test Room');
	logic.doneDefending('WillieDangDoodle');
	logic.doneDefending('Varzandeh');
	logic.doneDefending('Matt Crow');
	io.to('Test Room').emit('newdefendcount',1);

	socket.on('disconnect', function(data){
		logic.disconnect('WillieDangDoodle');
		logic.disconnect('Varzandeh');
		logic.disconnect('Matt Crow');
		logic.disconnect('Player1');
	});

	socket.on('donedefending',function(data){
		logic.doneDefending('Player1');
		logic.prepareForVotes('Test Room');
		io.to('Test Room').emit('newdefendcount',0);
		io.to('Test Room').emit('receivevote',logic.processVote('WillieDangDoodle','Matt Crow','Varzandeh'));
		io.to('Test Room').emit('receivevote',logic.processVote('Varzandeh','Player1','Matt Crow'));
		io.to('Test Room').emit('receivevote',logic.processVote('Matt Crow','Player1','Varzandeh'));
	});

	socket.on('playervotes', function(data){
		var result = logic.processVote('Player1',data.most,data.least);
		if (result.success){
			//tell everyone in room about vote
			io.to(result.roomName).emit('receivevote',result);
			if(result.votesNeeded == 0){
				var roomName = result.roomName;
				result = logic.endRound(result.roomName);
				io.to(roomName).emit('roundend',result);
				getAndSendStatements('Test Room');
				logic.doneDefending('WillieDangDoodle');
				logic.doneDefending('Varzandeh');
				logic.doneDefending('Matt Crow');
				io.to('Test Room').emit('newdefendcount',1);
			}
		}
		else{
			socket.emit('votefailed',result.message);
		}
	});
});
