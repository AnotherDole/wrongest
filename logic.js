/*
 * Game logic for The Wrongest Words
 */

var fs = require('fs');
var path = require('path');
var Hashids = require('hashids');
var Scripto = require('redis-scripto');
var scriptManager = null;
var secret = process.env.HASHID_SECRET || Math.random().toString();
var hashids = new Hashids(secret,0,'ABCDEFGHIJKLMNOPQRSTUVWXYZ');

var rooms = {}, decks = {}, deckData = {};
var client = null;
var gamesCreated = 0;

var ROUND_LIMIT = 5;

var MIN_PLAYERS = 3;
var MAX_PLAYERS = 8;

var GAME_PAUSED = -1;
var GAME_NOT_STARTED = 0;
var GAME_BETWEEN_ARGUMENTS = 1;
var GAME_SOMEONE_ARGUING = 2;
var GAME_WAITING_VOTES = 3;
var GAME_FINISHED = 4;

/************************** Begin deck loading logic ************/
fs.readdir('./decks/',function(err, list){
  var fileList = list.filter(function (file){
    return path.extname(file) === '.txt';
  });
  makeDecks(fileList);
});

function makeDecks(list){
  for(var i = 0; i < list.length; i++){
    try{
      var theFile = fs.readFileSync('./decks/'+list[i]);
      theFile = theFile.toString().split('\n');
      var theName = theFile[0].trim();
      decks[theName] = new masterDeck(theName,theFile[1].trim());
      for(var j = 3; j < theFile.length; j+=2){
	decks[theName].cards.push(theFile[j].trim());
      }
    }
    catch(err){
      console.log("Error parsing " + list[i]);
      console.log(err);
    }
  }
  for (var deck in decks){
    deckData[deck] = {name: deck, description: decks[deck].description, 
      numCards: decks[deck].cards.length};
  }
}
/************************ End deck loading logic **********************/

function masterDeck(name, description){
  this.name = name;
  this.description = description;
  this.cards = [];
}

function gameCard(number,masterCard) {
  this.number=number;
  this.inPlay=false;
  this.discarded=false;
  this.mostVotes = 0;
  this.leastVotes = 0;
  this.score=0;
  this.masterCard = masterCard;
}

function initializeGame(roomName,deckName,playerList,callback) {
  var i, theMulti = client.multi();
  for(i = 0; i < playerList.length; i++){
    theMulti.hmset(playerDataKey(roomName,playerList[i]),'score',0,'card',-1,'voted',0);
    theMulti.del(playerPreviousKey(roomName,playerList[i]));
  }
  var theDeck = decks[deckName];
  for(i = 0; i < theDeck.cards.length; i++){
    theMulti.hmset(cardDataKey(roomName,i+1),'inPlay',0,'discarded',0,'mostVotes',0,'leastVotes',0,'score',0);
  }
  theMulti.hmset(roomDataKey(roomName),'gameState',GAME_BETWEEN_ARGUMENTS,
      'cardsLeft',theDeck.cards.length,'round',1,'whosUp',-1,'deckLength',theDeck.cards.length);
  theMulti.exec(function(err,data){
    if(err){
      return callback(err,null);
    }
    return callback(null,{success:true,theRoom:roomName});
  })
}

function isValidName(name){
  if (name.length < 1 || name.length > 50){
    return false;
  }
  if(/[^A-Za-z0-9 ]/.test(name)){
    return false; 
  }
  return true;
}

function playerDataKey(roomName,playerName){
  return 'player:data:'+roomName+':'+playerName;
}

function playerPreviousKey(roomName,playerName){
  return 'player:previous:'+roomName+':'+playerName;
}

function roomDataKey(roomName){
  return 'room:data:'+roomName;
}

function roomPlayersKey(roomName){
  return 'room:players:'+roomName;
}

function roomWaitingKey(roomName){
  return 'room:waiting:'+roomName;
}

function roomLeaversKey(roomName,userName){
  return 'room:leavers:'+roomName+':'+userName;
}

function roomAllKey(roomName){
  return 'room:allEver:'+roomName;
}

function cardDataKey(roomName,cardNum){
  return 'card:'+roomName+':'+cardNum;
}

exports.getDeckData = function(){
  return deckData;
}

exports.roomExists = function(roomName,callback){
  client.exists(roomDataKey(roomName),callback);
}

exports.setClient = function(newClient){
  client = newClient;
  scriptManager = new Scripto(newClient);
  scriptManager.loadFromDir('./lua/');
}

//Create a new room. playerID is the requestor, name is requested name
exports.createRoom = function(playerName,UID,callback){
  if(playerName == null || playerName.trim() == ""){
    return callback(null,{success: false, message: "Please enter a name."});
  }
  var trimPlayer = playerName.trim();
  if(!isValidName(trimPlayer)){
    return callback(null,{success: false, message: "Invalid name."});
  }
  client.incr('roomsCreated', function(err, data) {
    if(err){
      return callback(true,null);
    }
    var roomName = hashids.encode(data + 1000);
    client.multi()
      .incr('activeRooms')
      .hmset([playerDataKey(roomName,trimPlayer),'uid',UID,'score',0,'card',-1,'voted',0])
      .hmset([roomDataKey(roomName),'dealer',trimPlayer,'gameState',GAME_NOT_STARTED,
		'votesReceived',0,'masterDeck','','timeLimit',-1,'allowRedraw',-1,'dealerFirst',1,
		'whosUp',-1,'round',0])
      .rpush([roomPlayersKey(roomName),trimPlayer])
      .sadd(roomAllKey(roomName),trimPlayer)
      .exec(function (err, data){
	if(err){
	  return callback(err,null)
	}
	console.log('Active rooms: ' + data[0]);
	callback(null, {success: true, roomName:roomName, playerName: trimPlayer});
      });
  });
}

//Returns object with array of player names and the leader
exports.getPlayersIn = function(roomName, callback){
  client.multi()
    .hmget([roomDataKey(roomName),'dealer','dealerFirst'])
    .lrange([roomPlayersKey(roomName),0,-1])
    .exec(function(err, data){
      if(err){
	return callback(err,null);
      }
      var toReturn = {};
      toReturn.success = true;
      var dealer = data[0][0];
      toReturn.dealer = dealer;
      toReturn.leader = dealer;
      var dealerFirst = data[0][1];
      var playerList = data[1];
      if(dealerFirst == '1'){
	while(playerList[0] != dealer){
	  playerList.push(playerList.shift());
	}
      }
      else{
	while(playerList[playerList.length-1] != dealer){
	  playerList.unshift(playerList.pop());
	}
      }
      toReturn.players = playerList;
      callback(null,toReturn);
    });
}

//playerName requests to join roomName
exports.joinRequest = function(roomName,playerName,UID,callback){
  if (playerName == null || playerName.trim() == ""){
    return callback(null, {success:false,message:"Please enter a name."});
  }
  var trimPlayer = playerName.trim();
  if(!isValidName(trimPlayer)){
    return callback(null,{success:false,message:'Invalid name'});
  }
  client.exists(roomDataKey(roomName),function(err, data){
    if(data == false){
      return callback(null,{success:false,message:'Room does not exist.'});
    }
    client.multi()
      .lrange(roomPlayersKey(roomName),0,-1)
      .lrange(roomWaitingKey(roomName),0,-1)
      .hget(roomDataKey(roomName),'gameState')
      .get(roomLeaversKey(roomName,trimPlayer))
      .exec(function(err, data){
	var currentPlayers = data[0];
	var waitingPlayers = data[1];
	var gameState = parseInt(data[2]);
	var previousScore = data[3];
	previousScore = (previousScore == null ? 0 : parseInt(previousScore));
	if(currentPlayers.length + waitingPlayers.length >= MAX_PLAYERS){
	  return callback(null,{success:false, message:'Room is full'});
	}
	if((currentPlayers.indexOf(trimPlayer) != -1) || (waitingPlayers.indexOf(trimPlayer) != -1)){
	  return callback(null,{success:false, message:'That name is already taken.'});
	}
	client.multi()
	.hmset(playerDataKey(roomName,trimPlayer),'uid',UID,'score',previousScore,'card',-1,'voted',0)
	.sadd(roomAllKey(roomName,trimPlayer),trimPlayer)
	.exec(function(err,data){
	  if(gameState > GAME_NOT_STARTED){
	    client.rpush(roomWaitingKey(roomName),trimPlayer,function(err,data){
	      callback(null,{success: true,waiting: true, roomName: roomName, playerName:trimPlayer});
	    });
	  }
	  else{
	    client.rpush(roomPlayersKey(roomName),trimPlayer,function(err,data){
	      var toReturn = {success: true, waiting: false, paused: false, roomName: roomName, playerName:trimPlayer };
	      if (gameState == GAME_PAUSED){
		toReturn.paused = true;
	      }
	      callback(null,toReturn);
	    });
	  }
	})
      })
    })
}

//playerName requests to leave their current room
exports.leaveRequest = function(roomName,playerName,callback){
  var keys = [roomPlayersKey(roomName),roomWaitingKey(roomName),playerDataKey(roomName,playerName),
	      roomDataKey(roomName),roomAllKey(roomName)];
  var args = [playerName,roomName];
  scriptManager.run('leaveRequest',keys,args,function(err,result){
    if(err){
      console.log(err);
      return callback(err,null);
    }
    var toReturn = {};
    toReturn.fromWaiting = (result[0] != null);
    toReturn.roomDeleted = (result[1] != null);
    toReturn.duringGame = (result[2] != null);
    toReturn.duringArg = (result[3] != null);
    toReturn.defenderLeft = (result[4] != null);
    toReturn.duringVote = (result[5] != null);
    toReturn.newNeeded = parseInt(result[6]);
    toReturn.theRoom = roomName;
    if(toReturn.roomDeleted){
      console.log('Active rooms: ' + result[7]);
    }
    callback(err,toReturn)
  })
}

//playerName requests to start roomName with given options
exports.startRequest = function(playerName,roomName,options,callback){
  var genericNo = {success:false, message:'no'};
  client.multi()
   .hmget(roomDataKey(roomName),'dealer','gameState')
   .smembers(roomAllKey(roomName))
   .exec(function(err,data){
     if(data[0] == null){
       return callback(null,genericNo);
     }
     var dealer = data[0][0];
     var gameState = data[0][1];
     var players = data[1];
     //These are just for saftey so no detailed error message
     if(playerName != dealer || players.length < MIN_PLAYERS || gameState != GAME_NOT_STARTED){
       return callback(null,genericNo);
     }
     if(decks[options['deckName']] == null){
       return callback(null,genericNo);
     }
     var timeLimit = parseInt(options['time']);
     if(isNaN(timeLimit) || timeLimit < 30){
       timeLimit = 60;
     }
     var allowRedraw = 0;
     if(options['allowRedraw'] == 'yes'){
       allowRedraw = 1;
     }
     var dealerFirst = 0;
     if(options['dealerFirstOrLast'] == 'first'){
       dealerFirst = 1;
     }
     client.hmset(roomDataKey(roomName),'masterDeck',options['deckName'],'timeLimit',timeLimit,
	 'allowRedraw',allowRedraw,'dealerFirst',dealerFirst,function(err,data){
	   return initializeGame(roomName,options['deckName'],players,callback);
	 });
   });
}

exports.tryRestartGame = function(roomName,playerName,callback){
  var keys = [roomDataKey(roomName),roomPlayersKey(roomName)];
  var args = [playerName,roomName];
  scriptManager.run('tryRestart',keys,args,function(err,result){
    if(err){
      console.log(err);
    }
    callback(null,(result != null));
  });
}

//return an object containing all the the statements
//assigned to the players in the room.
//return false if game is over
exports.getStatements = function(roomName,callback){
  var seed = Math.floor(Math.random() * Math.pow(2,32));
  //run lua script
  //result[0] is array of player names, result[1] is array of selected cards, result[2] is array of scores, result[3] is deck name
  scriptManager.run('getStatements',[roomDataKey(roomName),roomPlayersKey(roomName)],[ROUND_LIMIT,roomName,seed],function(err,result){
    if(err){
      console.log(err);
    }
    if(result == null){
      return callback(null,false);
    }
    var theDeck = decks[result[3]];
    var toReturn = {};
    for (var i = 0; i < result[0].length; i++){
      var theCard = theDeck.cards[result[1][i] - 1]
      toReturn[result[0][i]] = {quote: theCard, score: result[2][i]};
    }
    callback(err,toReturn);
  })
}

//adjust the play order for the given room
exports.adjustOrder = function(roomName,callback){
  scriptManager.run('adjustOrder',[roomDataKey(roomName),roomPlayersKey(roomName)],[],function(err,result){
    if(err){
      console.log(err);
    }
    exports.getPlayersIn(roomName,callback);
  })
}

//only called when there is a request to make someone defend
exports.getWhosUp = function(roomName,playerName,callback){
  scriptManager.run('getWhosUp',[roomDataKey(roomName),roomPlayersKey(roomName)],[playerName],function(err,result){
    if(err){
      console.log(err);
    }
    if(result == null){
      return callback(null,false)
    }
    callback(null,{player:result[0], time: parseInt(result[1])})
  })
}

exports.getWinner = function(roomName,callback){
  var seed = Math.floor(Math.random() * Math.pow(2,32));
  //data[0] is card number, data[1] is its score, data[2] is the deck name, data[3] is players who had that card
  scriptManager.run('getWinner',[roomDataKey(roomName),roomPlayersKey(roomName)],[roomName,seed],function (err,data){
    if (err) {
      console.log(err);
      return callback(err,null);
    }
    var cardNum = parseInt(data[0]), cardScore = parseInt(data[1]);
    var theDeck = decks[data[2]];
    var playerString = "", i;
    var toReturn = {card: theDeck.cards[cardNum-1], cardScore: cardScore, players: data[3]};
    return callback(null,toReturn);
  })
}

//playerName is done defending their statement
exports.doneDefending = function(roomName,playerName,callback){
  scriptManager.run('doneDefending',[roomDataKey(roomName),playerDataKey(roomName,playerName),roomPlayersKey(roomName)],[playerName],function(err,data){
    if(data == null){
      return callback(null,false);
    }
    callback(err,{success: true,roomName:roomName,votesNeeded:data});
  })
}

exports.prepareForVotes = function(roomName,callback){
  scriptManager.run('prepareForVotes',[roomDataKey(roomName),roomPlayersKey(roomName)],[roomName],function(err,result){
    //maybe include some error checking later
    callback(null,null)
  })
}

exports.processVote = function(roomName,playerName,mostWrong,leastWrong,callback){
  if(playerName == mostWrong || playerName == leastWrong || mostWrong == leastWrong){
    return callback(null,false)
  }

  var keys = [roomDataKey(roomName),roomPlayersKey(roomName),playerDataKey(roomName,playerName),
		playerDataKey(roomName,mostWrong),playerDataKey(roomName,leastWrong),roomWaitingKey(roomName)];
  var seed = Math.floor(Math.random() * Math.pow(2,32));
  var args = [playerName,mostWrong,leastWrong,roomName,seed]

  //result[0] is votes needed
  //if result[0] is 0 then it also returns:
  //result[1] = round
  //result[2] = number of cards left
  //result[3] = array of player names
  //result[4] = array of their scores
  //result[5] = array of the changes to their scores
  //result[6] = array of socket.io uuids to add to the room
  scriptManager.run('processVote',keys,args,function(err,result){
    if(result == null){
      return callback(null,false)
    }
    var toReturn = {votesNeeded:parseInt(result[0])};
    if(result[0] > 0){
      return callback(null, toReturn);
    }
    toReturn.socketsToAdd = result[6];
    toReturn.gameData = {round: (result[1]-1),cardsLeft:result[2]}
    toReturn.playerData = {}
    for(var i = 0; i < result[3].length; i++){
      toReturn.playerData[result[3][i]] = {newScore: result[4][i], scoreChange: result[5][i]};
    }
    callback(null,toReturn);
  })
}
