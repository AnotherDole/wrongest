var express = require('express');
var app = express();
app.set('trust proxy', true);
var server = require('http').createServer(app);
var io = require('socket.io')(server);

if(process.env.OPENSHIFT_NODEJS_PORT){
  io.origins('http://www.wrongest.net:*');
}

/*
io.use(function(socket,next){
  console.log(new Date(),socket.handshake);
  next();
})
*/

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

var morgan = require('morgan');


//credit: http://stackoverflow.com/a/15773824 
app.use(function(req, res, next) {
    if (req.path.substr(-1) == '/' && req.path.length > 1) {
        var query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});

app.use(express.static(__dirname + '/public'));
//app.use(morgan('combined'));
app.get('/:id',function(req,res){
  res.sendFile(__dirname + '/public/index.html');
});
app.get('/top10/lifetime',function(req,res){
  res.set('Access-Control-Allow-Origin','*');
  client.zrange('lifetimeScores',-10,-1,'WITHSCORES',function(err,result){
    if (result == null){
      res.json({});
    }
    else{
      res.json(result);
    }
  })
})
app.get('/bottom10/lifetime',function(req,res){
  res.set('Access-Control-Allow-Origin','*');
  client.zrange('lifetimeScores',0,9,'WITHSCORES',function(err,result){
    if (result == null){
      res.json({});
    }
    else{
      res.json(result);
    }
  })
})
app.get('/top10/:start/:end',function(req,res){
  res.set('Access-Control-Allow-Origin','*');
  var start = req.params.start;
  var end = req.params.end;
  if(start.length != 6 || end.length != 6){
    res.json({});
    return;
  }
  client.zrange('weekScores:'+start+':'+end,-10,-1,'WITHSCORES',function(err,result){
    if (result == null){
      res.json({});
    }
    else{
      res.json(result);
    }
  })
})
app.get('/bottom10/:start/:end',function(req,res){
  res.set('Access-Control-Allow-Origin','*');
  var start = req.params.start;
  var end = req.params.end;
  if(start.length != 6 || end.length != 6){
    res.json({});
    return;
  }
  client.zrange('weekScores:'+start+':'+end,0,9,'WITHSCORES',function(err,result){
    if (result == null){
      res.json({});
    }
    else{
      res.json(result);
    }
  })
})

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
  console.log(socket.id + ' connected');
  socket.on('createroom', function(playerName){
    if(socket.username != undefined){
      return false;
    }
    logic.createRoom(playerName, socket.id,function(err,result){
      if(!err){
	//join the socket.io room
	console.log(socket.id + ' name: ' + result.playerName + ' room: ' + result.roomName);
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

  socket.on('requestjoin', function(playerName,anyRoomName){
    var roomName = anyRoomName.toUpperCase();
    logic.joinRequest(roomName,playerName, socket.id,function(err,result){
      if (result.success){
	console.log(socket.id + ' name: ' + result.playerName + ' room: ' + result.roomName);
	socket.emit('deckdata',logic.getDeckData());
	result.link = 'http://' + server_address + '/' + result.roomName;
	socket.join(result.roomName);
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
	socket.username = result.playerName;
	socket.roomName = result.roomName;
      }
      else{
	socket.emit('joinresult',result);
      }
    });
  })

  socket.on('requestleave', function(){
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

  socket.on('donedefending', function(){
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

  socket.on('restartgame', function(){
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

  socket.on('disconnect', function(){
    console.log(socket.id + ' disconnects. name: ' + socket.username + ' room: ' + socket.roomName);
    if(socket.username === undefined){
      return;
    }
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

process.on('SIGTERM',function(){
  console.log('Disonnecting remaining sockets...');
  logic.purge(function(){
    process.exit();
  })
})
process.on('SIGINT',function(){
  console.log('Disonnecting remaining sockets...');
  logic.purge(function(){
    process.exit();
  })
})
