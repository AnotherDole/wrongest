/*
 * Game logic for The Wrongest Words
 */

var fs = require('fs');
var path = require('path');
var Hashids = require('hashids');
var Scripto = require('redis-scripto');
var scriptManager = null;
var hashids = new Hashids(Math.random().toString());

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
      for(var j = 3; j < theFile.length; j+=4){
	decks[theName].cards.push(new masterCard(theFile[j].trim(),
	      theFile[j+1].trim(),theFile[j+2].trim()));
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
function gamePlayer(name, UID){
  this.name = name;
  this.ID = UID;
  this.score = 0;
  this.card = null;
  this.voted = false;
  this.previousCards = [];
}

function gameRoom(name, leaderName,UID){
  this.name = name;
  this.leader = new gamePlayer(leaderName,UID);
  this.players = [this.leader];
  this.waiting = [];
  this.dealer = this.leader;
  this.gameState = GAME_NOT_STARTED;
  this.votesReceived = 0;
  this.masterDeck = null;
  this.deck = [];
  this.timeLimit = 60;
  this.allowRedraw = false;
  this.dealerFirst = false;
  this.whosUp = 0;
  this.round = 1;
  this.leaverData = {};
}

function masterDeck(name, description){
  this.name = name;
  this.description = description;
  this.cards = [];
}

function masterCard(quote, author, source){
  this.quote = quote;
  this.author = author;
  this.source = source;
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
  var trimPlayer = playerName.trim();
  if(!isValidName(trimPlayer)){
    return callback(null,{success: false, message: "Invalid name."});
  }

  client.incr('roomsCreated', function(err, data) {
    if(err){
      return callback(true,null);
    }
    var roomName = hashids.encode(data + 1000000000);
    client.multi()
      .hmset([playerDataKey(roomName,trimPlayer),'uid',UID,'score',0,'card',-1,'voted',0])
      .hmset([roomDataKey(roomName),'leader',trimPlayer,'dealer',trimPlayer,'gameState',GAME_NOT_STARTED,
		'votesReceived',0,'masterDeck','','timeLimit',-1,'allowRedraw',-1,'dealerFirst',1,
		'whosUp',-1,'round',0])
      .rpush([roomPlayersKey(roomName),trimPlayer])
      .exec(function (err, data){
	if(err){
	  return callback(true,null)
	}
	//console.log("Created room " + roomName + " with leader " + trimPlayer);
	callback(null, {success: true, roomName:roomName, playerName: trimPlayer});
      });
  });
}

//Returns object with array of player names and the leader
exports.getPlayersIn = function(roomName, callback){
  client.multi()
    .hmget([roomDataKey(roomName),'leader','dealer','dealerFirst'])
    .lrange([roomPlayersKey(roomName),0,-1])
    .exec(function(err, data){
      if(err){
	return callback(err,null);
      }
      var toReturn = {};
      toReturn.success = true;
      toReturn.leader = data[0][0];
      var dealer = data[0][1];
      toReturn.dealer = dealer;
      var dealerFirst = data[0][2];
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
exports.joinRequest = function(playerName,UID, roomName,callback){
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
	client.hmset(playerDataKey(roomName,trimPlayer),'uid',UID,'score',previousScore,'card',-1,'voted',0,function(err,data){
	  if(gameState > GAME_NOT_STARTED){
	    client.rpush(roomWaitingKey(roomName),trimPlayer,function(err,data){
	      callback(null,{success: true,waiting: true, roomName: roomName, playerName:trimPlayer});
	    });
	  }
	  else{
	    client.rpush(roomPlayersKey(roomName),trimPlayer,function(err,data){
	      callback(null,{success: true, waiting: false, roomName: roomName, playerName:trimPlayer});
	    });
	  }
	})
      })
  })
}

//playerName requests to leave their current room
exports.leaveRequest = function(playerName,roomName){
  //to be safe
  var theRoom = rooms[roomName];
  if(theRoom == null){
    return false;
  }
  var thePlayer = getPlayer(theRoom,playerName,true);
  if(thePlayer == null){
    return false;
  }
  var index = theRoom.players.indexOf(thePlayer);
  //if player came from the waiting list
  if(index < 0){
    index = theRoom.waiting.indexOf(thePlayer);
    theRoom.waiting.splice(index,1);
    //none of the rest is necessary if they were just waiting
    return {success: true, fromWaiting: true};
  }
  theRoom.players.splice(index,1);
  //console.log(playerName + " left room " + theRoom.name);
  //no one left in room, so delete it
  if(theRoom.players.length == 0){
    //console.log(theRoom.name + " was deleted");
    delete rooms[roomName];
    return {success: true, roomDeleted: true};
  }
  //need to find new leader
  if(theRoom.leader == thePlayer){
    theRoom.leader = theRoom.players[Math.floor(Math.random() * theRoom.players.length)];
    //console.log(theRoom.leader.name + " is the new leader");
  }
  if(theRoom.dealer == thePlayer){
    if(theRoom.dealerFirst){
      theRoom.dealer = theRoom.players[0];
    }
    else{
      theRoom.dealer = theRoom.players[theRoom.players.length-1];
    }
  }
  var toReturn = {success: true, roomDeleted: false, theRoom:theRoom.name, whoLeft: playerName, 
    duringArg: false, newNeeded: -1, duringVote: false, duringGame:false, defenderLeft:false};
  if(theRoom.gameState == GAME_BETWEEN_ARGUMENTS || theRoom.gameState == GAME_SOMEONE_ARGUING){
    toReturn.duringGame = true;
    toReturn.duringArg = true;
    thePlayer.card.inPlay = false;
    if(thePlayer.voted){
      theRoom.votesReceived--;
      theRoom.whosUp--;
    }
    toReturn.newNeeded = theRoom.players.length - theRoom.votesReceived;
    //the player who left was defending
    if(theRoom.gameState == GAME_SOMEONE_ARGUING && theRoom.whosUp == index){
      theRoom.gameState = GAME_BETWEEN_ARGUMENTS;
      toReturn.defenderLeft = true;
    }
  }
  else if (theRoom.gameState == GAME_WAITING_VOTES){
    toReturn.duringGame = true;
    thePlayer.card.inPlay = false;
    toReturn.duringVote = true;
  }
  theRoom.leaverData[thePlayer.name] = {score: thePlayer.score, previous: thePlayer.previousCards};
  return toReturn;
}

exports.pauseGame = function(roomName){
  var thePlayer, theCard;
  var theRoom = rooms[roomName];
  theRoom.gameState = GAME_PAUSED;
  theRoom.votesReceived = 0;
  for(var i = 0; i < theRoom.players.length; i++){
    thePlayer = theRoom.players[i];
    thePlayer.voted = false;
    theCard = thePlayer.card;
    theCard.mostVotes = 0;
    theCard.leastVotes = 0;
    theCard.inPlay = false;
    thePlayer.card = null;
  }
  while(theRoom.waiting.length > 0){
    theRoom.players.push(theRoom.waiting.shift());
  }
}

//playerName requests to start roomName with given options
exports.startRequest = function(playerName,roomName,options,callback){
  var genericNo = {success:false, message:'no'};
  client.multi()
   .hmget(roomDataKey(roomName),'leader','dealer','gameState')
   .lrange(roomPlayersKey(roomName),0,-1)
   .exec(function(err,data){
     if(data[0] == null){
       return callback(null,genericNo);
     }
     var leader = data[0][0];
     var dealer = data[0][1];
     var gameState = data[0][2];
     var players = data[1];
     //These are just for saftey so no detailed error message
     if(playerName != leader || players.length < MIN_PLAYERS || gameState != GAME_NOT_STARTED){
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

exports.canRestartGame = function(playerName,roomName){
  var theRoom = rooms[roomName];
  if(theRoom == null) return false;
  if(theRoom.gameState != GAME_PAUSED) return false;
  if(theRoom.players.length < MIN_PLAYERS) return false;

  var thePlayer = getPlayer(theRoom,playerName,false);
  if(thePlayer == null) return false;
  if(theRoom.leader != thePlayer) return false;

  theRoom.gameState = GAME_BETWEEN_ARGUMENTS;
  return true;
}

//return an object containing all the the statements
//assigned to the players in the room.
//return false if game is over
exports.getStatements = function(roomName,callback){
  var seed = Math.floor(Math.random() * Math.pow(2,32));
  //run lua script
  //result[0] is array of player names, result[1] is array of selected cards, result[2] is array of scores, result[3] is deck name
  scriptManager.run('getStatements',[roomDataKey(roomName),roomPlayersKey(roomName)],[ROUND_LIMIT,roomName,seed],function(err,result){
    var theDeck = decks[result[3]];
    var toReturn = {};
    for (var i = 0; i < result[0].length; i++){
      var theCard = theDeck.cards[result[1][i] - 1]
      toReturn[result[0][i]] = {quote: theCard.quote, author: theCard.author, source: theCard.source, score: result[2][i]};
    }
    callback(err,toReturn);
  })
}

//adjust the play order for the given room
exports.adjustOrder = function(roomName,callback){
  scriptManager.run('adjustOrder',[roomDataKey(roomName),roomPlayersKey(roomName)],[],function(err,result){
    exports.getPlayersIn(roomName,callback);
  })
}

//only called when there is a request to make someone defend
exports.getWhosUp = function(roomName,playerName,callback){
  scriptManager.run('getWhosUp',[roomDataKey(roomName),roomPlayersKey(roomName)],[playerName],function(err,result){
    if(result == null){
      return callback(null,false)
    }
    callback(null,{player:result[0], time: parseInt(result[1])})
  })
}

exports.getWinner = function(roomName){
  var theRoom = rooms[roomName];
  theRoom.gameState = GAME_FINISHED;
  var result = {};
  var wPlayer, playerScore = -1, wCard, cardScore = 99999, i;
  for (i = 0; i < theRoom.players.length; i++){
    var thePlayer = theRoom.players[i];
    if(thePlayer.score > playerScore){
      playerScore = thePlayer.score;
      wPlayer = thePlayer.name;
    }
  }
  for(i = 0; i < theRoom.deck.length; i++){
    var theCard = theRoom.deck[i];
    if(theCard.score < cardScore){
      cardScore = theCard.score;
      wCard = theCard.masterCard.quote;
    }
  }
  //console.log("Game in " + roomName + " is over.");
  return {player: wPlayer, playerScore: playerScore, card: wCard, cardScore: cardScore};
}

//playerName is done defending their statement
exports.doneDefending = function(roomName,playerName,callback){
  scriptManager.run('doneDefending',[roomDataKey(roomName),playerDataKey(roomName,playerName),roomPlayersKey(roomName)],[playerName],function(err,data){
    if(data == null){
      return callback(null,false);
    }
    callback(null,{success: true,roomName:roomName,votesNeeded:data});
  })
}

exports.prepareForVotes = function(roomName){
  var theRoom = rooms[roomName];
  theRoom.gameState = GAME_WAITING_VOTES;
  theRoom.votesReceived = 0;
  for(var i = 0; i < theRoom.players.length; i++){
    theRoom.players[i].voted = false;
  }
}

exports.processVote = function(roomName,playerName,mostWrong,leastWrong){
  var theRoom = rooms[roomName];
  if(theRoom == null){
    return {success: false,message:"Not in a room."};
  }
  if(theRoom.gameState != GAME_WAITING_VOTES){
    return {success:false, message:"It's not time to vote yet!"};
  }
  var thePlayer = getPlayer(theRoom,playerName,false);
  if(thePlayer == null){
    return {success: false, message: "You're not in that room."};
  }
  if(thePlayer.voted){
    return {success: false, message: "You already voted."};
  }
  if(mostWrong == leastWrong){
    return {success: false, message: "You must vote for different players."};
  }
  var mostPlayer = getPlayer(theRoom,mostWrong,false);
  var leastPlayer = getPlayer(theRoom,leastWrong,false);
  if(mostPlayer == null || leastPlayer == null){
    return {success: false, message: "Invalid player names."};
  }
  if(mostPlayer == thePlayer || leastPlayer == thePlayer){
    return {success: false, message: "You cannot vote for yourself"};
  }
  //vote is go
  var mostCard = mostPlayer.card;
  var leastCard = leastPlayer.card;
  mostCard.mostVotes++
    leastCard.leastVotes++;
  thePlayer.voted = true;
  theRoom.votesReceived++;
  var votesNeeded = theRoom.players.length - theRoom.votesReceived;
  //console.log("Player " + thePlayer.name + " votes: most is " + mostWrong + ", least is " + leastWrong);
  return { success: true, roomName: theRoom.name, voter: playerName, mostName: mostWrong, leastName: leastWrong,
    votesNeeded: votesNeeded};
}

//return game summary
exports.endRound = function(roomName){
  var theRoom = rooms[roomName];
  var i, theCard, thePlayer, toAdd;
  var result = {};
  result.playerData = {};
  result.socketsToAdd = [];
  //handle scoring, both for players and cards
  for(i = 0; i < theRoom.players.length; i++){
    thePlayer = theRoom.players[i];
    thePlayer.voted = false;
    theCard = thePlayer.card;
    toAdd = theCard.leastVotes;
    if(theCard.score < -1){
      toAdd *= 2;
    }
    thePlayer.score += toAdd;
    result.playerData[thePlayer.name] = {scoreChange: toAdd, newScore: thePlayer.score};
    theCard.score += theCard.leastVotes;
    theCard.score -= theCard.mostVotes;
    if(theCard.score >= 0){
      theCard.discarded = true;
      theRoom.cardsLeft--;
    }
    else if(theCard.score == -1){
      var coinflip = Math.floor(Math.random() * 2);
      if(coinflip == 0){
	theCard.discarded = true;
	theRoom.cardsLeft--;
      }
      //put card back in play
      else{
	theCard.inPlay = false;
      }
    }
    else{
      theCard.inPlay = false;
    }
  }
  theRoom.gameState = GAME_BETWEEN_ARGUMENTS;
  result.gameData = {round: theRoom.round, cardsLeft: theRoom.cardsLeft};
  theRoom.round++;
  theRoom.votesReceived = 0;
  //add players from the waiting list to the game
  while(theRoom.waiting.length > 0){
    var fromWaiting = theRoom.waiting[0];
    result.playerData[fromWaiting.name] = {scoreChange: 0, newScore: fromWaiting.score};
    result.socketsToAdd.push(fromWaiting.ID);
    if(theRoom.dealerFirst){
      theRoom.players.push(theRoom.waiting.shift());
    }
    else{
      theRoom.players.unshift(theRoom.waiting.shift());
    }
  }
  return result;
}
