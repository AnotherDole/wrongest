var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var redis = require('redis');

var redisHost = process.env.REDIS_HOST || '127.0.0.1';
var redisPort = process.env.REDIS_PORT || '6379';
var redisPass = process.env.REDIS_PASS || '';
var client = redis.createClient(redisPort, redisHost, {auth_pass: redisPass});

var adapter = require('socket.io-redis');
var pub = redis.createClient(redisPort, redisHost, { auth_pass: redisPass});
var sub = redis.createClient(redisPort, redisHost, { detect_buffers: true, auth_pass: redisPass});
io.adapter(adapter({pubClient: pub, subClient: sub}));

var port = process.env.OPENSHIFT_NODEJS_PORT || 3000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var server_address = process.env.OPENSHIFT_APP_DNS ? 'www.wrongest.net' : ('localhost:'+port);

var logic = require('./logic.js');
logic.setClient(client);

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
  res.sendFile(__dirname + '/public/index.html');
});

//call logic to assign statements to everyone
//receive a summary to send to everyone in room
//Or declare a winner
function getAndSendStatements(roomName,callback){
  logic.getStatements(roomName,function(err,result){
    if(result == false){
      logic.getWinner(roomName,function(err,data){
	io.to(roomName).emit('gameover',data.card,data.cardScore,data.players, data.playerList, data.theScores);
	return callback(false);
      })
    }
    else{
      io.to(roomName).emit('getstatements',result);
      return callback(true);
    }
  });
}

//Common code for when a player leaves or disconnects
function leaveOrDisconnect(result){
  if(result.roomDeleted || result.fromWaiting) return;

  logic.getPlayersIn(result.theRoom,function(err,playerList){
    if(!result.duringGame){
      io.to(result.theRoom).emit('updatecurrentroom',playerList.players,playerList.leader,playerList.dealer, playerList.scores);
      return;
    }
    if(playerList.players.length <= 2){
      io.to(result.theRoom).emit('pausegame');
      //this is necessary because waiting players may have been added
      logic.getPlayersIn(result.theRoom,function(err,newList){
	io.to(result.theRoom).emit('updatecurrentroom',newList.players,newList.leader,newList.dealer,newList.scores);
	return;
      })
    }
    else{
      io.to(result.theRoom).emit('updatecurrentroom', playerList.players, playerList.leader, playerList.dealer,playerList.scores);
      //if the person who left was defending
      if((result.duringArg && result.defenderLeft) || result.newNeeded == 0){
	io.to(result.theRoom).emit('newdefendcount',result.newNeeded,true);
      }
      else{
	io.to(result.theRoom).emit('newdefendcount',result.newNeeded,false);
      }
      if(result.newNeeded == 0){
	logic.prepareForVotes(result.theRoom,function(err,result){
	})
      }
      else if(result.duringVote){
	//For now, just call for a new vote
	logic.prepareForVotes(result.theRoom,function(er,result){
	  io.to(result.theRoom).emit('newdefendcount',0,false);
	})
      }
    }
  })
}


io.on('connection', function (socket){
  //data is the requested room name
  socket.on('createroom', function(playerName){
    if(socket.username != undefined){
      return false;
    }
    logic.createRoom(playerName, socket.id,function(err,result){
      if(!err){
	//join the socket.io room
	socket.username = result.playerName;
	socket.roomName = result.roomName;
	socket.join(result.roomName);
	result.link = 'http://' + server_address + '/' + result.roomName;
	socket.emit('createresult',result);
	socket.emit('deckdata',logic.getDeckData());
	var blar = logic.getPlayersIn(result.roomName,function(err,blar){;
	  io.to(result.roomName).emit('updatecurrentroom',blar.players,blar.leader,blar.dealer,blar.scores);
	});
      }
    });
  });

  socket.on('requestroomdata', function(roomName){
    if(socker.roomName == roomName){
      logic.getPlayersIn(roomName.toUpperCase(), function(err,result){
	socket.emit('updatecurrentroom',result.players,result.leader,result.dealer,result.scores);
      });
    }
  });

  // data is requested room name
  socket.on('requestjoin', function(playerName,anyRoomName){
    var roomName = anyRoomName.toUpperCase();
    logic.joinRequest(roomName,playerName, socket.id,function(err,result){
      if (result.success){
	socket.emit('deckdata',logic.getDeckData());
	result.link = 'http://' + server_address + '/' + result.roomName;
	socket.join(roomName);
	if(!result.waiting){
	  //tell everyone in same room to update display
	  socket.emit('joinresult',result);
	  if(result.paused){
	    socket.emit('pausegame');
	  }
	  logic.getPlayersIn(roomName,function (err,blar){
	    io.to(roomName).emit('updatecurrentroom',blar.players,blar.leader,blar.dealer,blar.scores);
	  });
	}
	else{
	  socket.emit('joinresult',result);
	  logic.getPlayersIn(roomName, function (err, blar){
	    socket.emit('updatecurrentroom',blar.players,blar.leader,blar.dealer,blar.scores);
	  })
	}
	socket.username = playerName;
	socket.roomName = roomName;
      }
      else{
	socket.emit('joinresult',result);
      }
    });
  })

  //data isn't necessary 
  socket.on('requestleave', function(data){
    logic.leaveRequest(socket.roomName,socket.username,function(err,result){
      if (result){
	socket.leave(socket.roomName);
	delete socket.username;
	delete socket.roomName;
	leaveOrDisconnect(result);
      }
      socket.emit('leaveresult',result);
    });
  });

  //request to start a game with certain options
  socket.on('requeststart', function(deckName, time, allowRedraw, dealerFirstOrLast){
    var options = {deckName: deckName, time: time, allowRedraw: allowRedraw, dealerFirstOrLast: dealerFirstOrLast};
    logic.startRequest(socket.username,socket.roomName,options,function(err,result){
      socket.emit('startresult',result);
      //time to start game, send out the first statements
      if(result.success){
	getAndSendStatements(socket.roomName,function(uh){
	  logic.adjustOrder(socket.roomName,function(err,order){
	    io.to(socket.roomName).emit('updatecurrentroom',order.players,order.leader,order.dealer,order.scores);
	  });
	})
      }
    });
  });

  socket.on('makedefend', function(){
    logic.getWhosUp(socket.roomName, socket.username,function(err,result){
      if(result){
	io.to(socket.roomName).emit('timetodefend',result.player,result.time);
      }
    })
  });

  socket.on('donedefending', function(data){
    logic.doneDefending(socket.roomName, socket.username,function(err,result){
      if(result.success){
	//tell everyone in room new votesNeeded
	io.to(socket.roomName).emit('newdefendcount',result.votesNeeded,true);
	if(result.votesNeeded <= 0){
	  logic.prepareForVotes(socket.roomName,function(err,result){
	    //nothing yet
	  })
	}
      }
      else{
	//tell specific user they are stupid
	socket.emit('donefailed', 'no');
      }
    })
  });

  socket.on('playervotes',function(most,least){
    logic.processVote(socket.roomName,socket.username,most,least,function(err,result){
      if (result){
	if(result.votesNeeded == 0){
	  io.to(socket.roomName).emit('roundend',result);
	  getAndSendStatements(socket.roomName,function(uh){
	    logic.adjustOrder(socket.roomName,function(err,order){
	      io.to(socket.roomName).emit('updatecurrentroom',order.players,order.leader,order.dealer,order.scores);
	    })
	  })
	}
      }
      else{
	socket.emit('votefailed');
      }
    })
  });

  socket.on('restartgame', function(data){
    logic.tryRestartGame(socket.roomName,socket.username,function(err,result){
      if(result){
	getAndSendStatements(socket.roomName,function(uh){
	  logic.adjustOrder(socket.roomName,function(err,order){
	    io.to(socket.roomName).emit('updatecurrentroom',order.players,order.leader,order.dealer,order.scores);
	    io.to(socket.roomName).emit('newdefendcount',order.players.length,true);
	  })
	})

      }
    });
  });

  socket.on('disconnect', function(data){
    logic.leaveRequest(socket.roomName,socket.username,function(err,result){
      if(result && !result.roomDeleted){
	leaveOrDisconnect(result);
      }
      if(testing) playing--;
    })
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
