/*
 * Game logic for The Wrongest Words
 */

var fs = require('fs');
var path = require('path');

var players = {}, rooms = {}, decks = {};

var MIN_PLAYERS = 3;
var MAX_PLAYERS = 8;

var GAME_NOT_STARTED = 0;
var GAME_WAITING_ARGUMENTS = 1;
var GAME_WAITING_VOTES = 2;
var GAME_FINISHED = 3;

/************************** Begin deck loading logic ************/
fs.readdir('./decks/',function(err, list){
	var fileList = list.filter(function (file){
		return path.extname(file) === '.txt';
	})
	makeDecks(fileList);
});

function makeDecks(list){
	for(var i = 0; i < list.length; i++){
		var theFile = fs.readFileSync('./decks/'+list[i]);
		theFile = theFile.toString().split('\n');
		var theName = theFile[0].trim();
		decks[theName] = new masterDeck(theName,theFile[1].trim());
		for(var j = 3; j < theFile.length; j+=4){
			decks[theName].cards.push(new masterCard(theFile[j].trim(),
						theFile[j+1].trim(),theFile[j+2].trim()));
		}
	}
}
/************************ End deck loading logic **********************/
exports.reset = function(){
	players = {};
	rooms = {};
}

function gamePlayer(name, playerID){
	this.name = name;
	this.ID = playerID;
	this.room = null;
	this.score = 0;
	this.cardNum = 0;
	this.voted = false;
}

function gameRoom(name, leaderName,password){
	this.name = name;
	this.leader = leaderName;
	this.password = password;
	this.players = [leaderName];
	this.gameState = GAME_NOT_STARTED;
	this.votesReceived = 0;
	this.masterDeck = null;
	this.deck = [];
	this.round = 1;
}

function masterDeck(name, description){
	this.name = name;
	this.description = description;
	this.cards = [];
}

function masterCard(quote, author, episode){
	this.quote = quote;
	this.author = author;
	this.episode = episode;
}

function gameCard(number) {
        this.number=number;
        this.inplay=false;
        this.discarded=false;
	this.mostVotes = 0;
	this.leastVotes = 0;
        this.score=0;
}

function initializeGame(gameRoom,deckName) {
	var i;
	//reset player data
	for (i=0; i < gameRoom.players.length; i++){
		players[gameRoom.players[i]].score=0;
		players[gameRoom.players[i]].cardNum=0;
		players[gameRoom.players[i]].voted = false;
	}
	var theDeck = decks[deckName];
	gameRoom.deck = [];
	for(i = 0; i < theDeck.cards.length; i++){
		gameRoom.deck.push(new gameCard(i));
	}
	gameRoom.masterDeck = theDeck;
	gameRoom.gameState = GAME_WAITING_ARGUMENTS;
	gameRoom.cardsLeft = gameRoom.deck.length;
	gameRoom.round = 1;
}

exports.getDeckData = function(){
	var theAnswer = {};
	for (var deck in decks){
		theAnswer[deck] = {name: deck, description: decks[deck].description, 
			numCards: decks[deck].cards.length};
	}
	return theAnswer;
}

//Register playerID's name as playerName
exports.addPlayer = function(playerName, playerID){
	var reqName = playerName.trim();
	if (reqName.length < 3){
		return {success: false, message: "Your name must be longer than 2 characters"};
	}
	if(/[^A-Za-z0-9 ]/.test(reqName)){
		return {success: false, message: "Your name can only contain letters, numbers, and spaces."}
	}
	//check if that playerID has already signed on
	if(players[reqName] != null){
		return {success: false, message: "Someone else already has that name."};
	}
	players[reqName] = new gamePlayer(reqName, playerID);
	console.log('Added player ' + reqName);
	return {success:true, name:reqName};
}

//Create a new room. playerID is the requestor, name is requested name
exports.createRoom = function(playerName,thename,password){
	//check if player has chosen a name yet
	var thePlayer = players[playerName];
	if(thePlayer == null){
		return {success:false, message: "You must choose a username first."};
	}
	//check if player is already in a room
	if(thePlayer.room != null){
		return {success: false, message: "You must leave your current room before joining another."};
	}
	reqname = thename.trim();
	//no really short names
	if (reqname.length < 3){
		return {success: false, message: "Room names must be at least 3 characters long"};
	}
	if(/[^A-Za-z0-9 ]/.test(reqname)){
		return {success: false, message: "Room names can only contain letters, numbers, and spaces."}
	}
	//check if room name already exists
	if(rooms[reqname] != null){
		return {success: false, message:"A room with that name already exists"};
	}
	var reqPass;
	if(password == null){
		reqPass = "";
	}
	else{
		reqPass = password.trim();
	}
	rooms[reqname] = new gameRoom(reqname,playerName,reqPass);
	players[playerName].room = reqname;
	console.log("Created room " + reqname + " with leader " + playerName);
	return {success: true, name:reqname};
}

//Returns object describing current rooms
exports.getAllRoomData = function(){
	var toReturn = {};
	for (var room in rooms){
		var roomName = rooms[room].name;
		toReturn[roomName]= {name: roomName, playerCount: rooms[room].players.length};
	}
	return toReturn;
}

//Returns object with array of player names and the leader
exports.getPlayersIn = function(roomName){
	var theRoom = rooms[roomName];
	if(theRoom == null){
		return {success: false, message:"That room doesn't exist."};
	}
	var toReturn = {success: true};
	toReturn["roomName"] = roomName;
	toReturn["leader"] = theRoom.leader;
	toReturn["players"] = [];
	for(var i = 0; i < theRoom.players.length; i++){
		toReturn["players"].push(theRoom.players[i]);
	}
	return toReturn; 
}

//playerName requests to join roomName
exports.joinRequest = function(playerName, roomName,password){
	var thePlayer = players[playerName];
	var theRoom = rooms[roomName];
	//check if room exits. this should just be for safety.
	if (theRoom == null){
		return {success: false, message:"That room does not exist."};
	}
	if(thePlayer == null){
		return {success: false, message:"You haven't loggged in yet"};
	}
	//check if player is already in a room
	if (thePlayer.room != null){
		return {success: false, message:"You must leave your current room first"};
	}
	//full room
	if (theRoom.players.length >= MAX_PLAYERS){
		return {success: false, message:"That room is full."};
	}
	if(theRoom.gameState != GAME_NOT_STARTED){
		return {success: false, message:"You cannot join a game in progress."};
	}
	var givenPass;
	if(password == null){
		givenPass = "";
	}
	else{
		givenPass = password.trim();
	}
	if(givenPass != theRoom.password){
		return {success: false, message:"Wrong password."}
	}
	thePlayer.room = roomName;
	theRoom.players.push(playerName);
	console.log(playerName + " joined room " + theRoom.name);
	return {success: true};
}

//playerID requests to leave their current room
exports.leaveRequest = function(playerName){
	//to be safe
	var thePlayer = players[playerName];
	if(thePlayer == null){
		return {success: false, message: "Player does not exist"};
	}	
	var theRoom = rooms[thePlayer.room];
	if(theRoom == null){
		return {success: false, message: "Player is not in a room."};
	}

	theRoom.players.splice(theRoom.players.indexOf(playerName),1);
	console.log(playerName + " left room " + theRoom.name);
	//no one left in room, so delete it
	if(theRoom.players.length == 0){
		console.log(theRoom.name + " was deleted");
		delete rooms[thePlayer.room];
		thePlayer.room = null;
		return {success: true, roomDeleted: true};
	}
	thePlayer.room = null;

	//need to find new leader
	if(theRoom.leader == playerName){
		theRoom.leader = theRoom.players[Math.floor(Math.random() * theRoom.players.length)];
		console.log(players[theRoom.leader].name + " is the new leader");
	}
	var toReturn = {success: true, roomDeleted: false, theRoom:theRoom.name, whoLeft: playerName, duringArg: false, newNeeded: 0, duringVote: false};
	if(theRoom.gameState == GAME_WAITING_ARGUMENTS){
		theRoom.deck[thePlayer.cardNum].inplay = false;
		toReturn.duringArg = true;
		if(thePlayer.voted){
			theRoom.votesReceived--;
		}
		toReturn.newNeeded = theRoom.players.length - theRoom.votesReceived;
	}
	else if (theRoom.gameState == GAME_WAITING_VOTES){
		theRoom.deck[thePlayer.cardNum].inplay = false;
		toReturn.duringVote = true;
	}
	return toReturn;
}

exports.disconnect = function(playerName){
	var result = exports.leaveRequest(playerName);
	delete players[playerName];
	return result;
}

//playerID requests to start the room they are leading
exports.startRequest = function(playerName,deckName){
	var thePlayer = players[playerName];
	if(thePlayer == null){
		return {success: false, message: "You do not exist"};
	}
	var theRoom = rooms[thePlayer.room];
	if(theRoom == null){
		return {success: false, message: "You are not in a room."};
	}
	if(theRoom.leader != playerName){
		return {success: false, message: "You are not the leader of your current room."};
	}
	if(theRoom.players.length < 3){
		return {success: false, message: "You need 3 players to play this game."};
	}
	if(theRoom.gameState != GAME_NOT_STARTED){
		return {success: false, message: "The game is already in progress."};
	}
	if(decks[deckName] == null){
		return {success: false, message: "That deck doesn't exist"};
	}
	//everything's fine, start the game
	console.log(theRoom.name + " has started playing with deck "+deckName);
	initializeGame(theRoom,deckName);
	return {success: true, theRoom:theRoom.name};
}

//return an object containing all the the statements
//assigned to the players in the room.
//return false if game is over
exports.getStatements = function(roomName){
	//eventually check that this makes sense
	var theRoom = rooms[roomName];
	if(theRoom.cardsLeft < theRoom.players.length){
		return false;
	}
	var result = {};
	var i,selected, theCard;
	for(i = 0; i < theRoom.players.length; i++){
		var keep = true;
		while(keep){
			selected = Math.floor(Math.random() * theRoom.deck.length);
			theCard = theRoom.deck[selected];
			if(theCard.inplay == false && theCard.discarded == false){
				keep = false;
				theCard.inplay = true;
				theCard.mostVotes = 0;
				theCard.leastVotes = 0;
				var playerName = theRoom.players[i];
				var masterCard = theRoom.masterDeck.cards[theCard.number];
				players[playerName].cardNum = selected;
				result[playerName] = {
					quote: masterCard.quote,
					author: masterCard.author,
					episode: masterCard.episode,
					score: theCard.score
				};
			}
		}
	}
	console.log("Sent statements to " + theRoom.name);
	return result;
}

exports.getWinner = function(roomName){
	var theRoom = rooms[roomName];
	theRoom.gameState = GAME_FINISHED;
	var result = {};
	var wPlayer, playerScore = -1, wCard, cardScore = 99999, i;
	for (i = 0; i < theRoom.players.length; i++){
		var thePlayer = players[theRoom.players[i]];
		if(thePlayer.score > playerScore){
			playerScore = thePlayer.score;
			wPlayer = thePlayer.name;
		}
	}
	for(i = 0; i < theRoom.deck.length; i++){
		var theCard = theRoom.deck[i];
		if(theCard.score < cardScore){
			cardScore = theCard.score;
			wCard = theRoom.masterDeck.cards[theCard.number].quote;
		}
	}
	console.log("Game in " + roomName + " is over.");
	return {player: wPlayer, playerScore: playerScore, card: wCard, cardScore: cardScore};
}

//playerID is done defending their statement
exports.doneDefending = function(playerName){
	var thePlayer = players[playerName];
	//i hate having to do this
	if (thePlayer == null){
		return {success: false, message: "You don't exist."};
	}
	var theRoom = rooms[thePlayer.room];
	if (theRoom == null){
		return {success: false, message: "You are not in a room."};
	}
	if (theRoom.gameState != GAME_WAITING_ARGUMENTS){
		return {success: false, message: "It's not time for that."};
	}
	//player already voted
	if(thePlayer.voted){
		return {success: false, message: "You already said you were done."};
	}
	//okay, the vote matters
	thePlayer.voted = true;
	theRoom.votesReceived++;
	console.log(playerName + " is done defending");
	return {success:true, roomName:theRoom.name, votesNeeded: (theRoom.players.length - theRoom.votesReceived)};
}

exports.prepareForVotes = function(roomName){
	var theRoom = rooms[roomName];
	theRoom.gameState = GAME_WAITING_VOTES;
	theRoom.votesReceived = 0;
	for(var i = 0; i < theRoom.players.length; i++){
		players[theRoom.players[i]].voted = false;
	}
}

exports.processVote = function(playerName,mostWrong,leastWrong){
	var thePlayer = players[playerName];
	if (thePlayer == null){
		return {success: false, message: "You haven't signed in yet."};
	}
	var theRoom = rooms[thePlayer.room];
	if(theRoom == null){
		return {success: false,message:"Not in a room."};
	}
	if(theRoom.gameState != GAME_WAITING_VOTES){
		return {success:false, message:"It's not time to vote yet!"};
	}
	if(thePlayer.voted){
		return {success: false, message: "You already voted."};
	}
	if(mostWrong == leastWrong){
		return {success: false, message: "You must vote for different players."};
	}
	var mostPlayer = players[mostWrong];
	var leastPlayer = players[leastWrong];
	if(mostPlayer == null || leastPlayer == null){
		return {success: false, message: "Invalid player names."};
	}
	if(mostPlayer.room != theRoom.name || leastPlayer.room != theRoom.name){
		return {success: false, message: "Invalid player names."};
	}
	if(mostPlayer == thePlayer || leastPlayer == thePlayer){
		return {success: false, message: "You cannot vote for yourself"};
	}
	//vote is go
	var mostCard = theRoom.deck[mostPlayer.cardNum];
	var leastCard = theRoom.deck[leastPlayer.cardNum];
	mostCard.mostVotes++
	leastCard.leastVotes++;
	thePlayer.voted = true;
	theRoom.votesReceived++;
	var votesNeeded = theRoom.players.length - theRoom.votesReceived;
	console.log("Player " + thePlayer.name + " votes: most is " + mostWrong + ", least is " + leastWrong);
	return { success: true, roomName: theRoom.name, voter: playerName, mostName: mostWrong, leastName: leastWrong,
		votesNeeded: votesNeeded};
}

//return game summary
exports.endRound = function(roomName){
	var theRoom = rooms[roomName];
	var i, theCard, thePlayer, toAdd;
	var result = {};
	result.playerData = {};
	for(i = 0; i < theRoom.players.length; i++){
		thePlayer = players[theRoom.players[i]];
		thePlayer.voted = false;
		theCard = theRoom.deck[thePlayer.cardNum];
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
				theCard.inplay = false;
			}
		}
		else{
			theCard.inplay = false;
		}
	}
	theRoom.gameState = GAME_WAITING_ARGUMENTS;
	result.gameData = {round: theRoom.round, cardsLeft: theRoom.cardsLeft};
	theRoom.round++;
	theRoom.votesReceived = 0;
	return result;
}
