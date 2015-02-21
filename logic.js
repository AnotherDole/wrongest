/*
 * Game logic for The Wrongest Words
 */

var fs = require('fs');
var path = require('path');
var Hashids = require('hashids');
var hashids = new Hashids(Math.random().toString());

var rooms = {}, decks = {}, deckData = {};
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

function initializeGame(gameRoom,deckName) {
	var i;
	//reset player data
	for (i=0; i < gameRoom.players.length; i++){
		gameRoom.players[i].score=0;
		gameRoom.players[i].card=null;
		gameRoom.players[i].voted = false;
		gameRoom.players[i].previousCards = [];
	}
	var theDeck = decks[deckName];
	gameRoom.masterDeck = theDeck;
	gameRoom.deck = [];
	for(i = 0; i < theDeck.cards.length; i++){
		gameRoom.deck.push(new gameCard(i,gameRoom.masterDeck.cards[i]));
	}
	gameRoom.gameState = GAME_BETWEEN_ARGUMENTS;
	gameRoom.cardsLeft = gameRoom.deck.length;
	gameRoom.round = 1;
}

//return reference to the player
function getPlayer(theRoom,playerName,includeWaiting){
	var answer = null;
	for(var i = 0; i < theRoom.players.length; i++){
		if(theRoom.players[i].name == playerName){
			answer = theRoom.players[i];
			break;
		}
	}
	if(includeWaiting){
		for (var i = 0; i < theRoom.waiting.length; i++){
			if(theRoom.waiting[i].name == playerName){
				answer = theRoom.waiting[i];
				break;
			}
		}
	}
	return answer;
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

exports.getDeckData = function(){
	return deckData;
}

exports.roomExists = function(roomName){
	return (rooms[roomName] != null);
}

//Create a new room. playerID is the requestor, name is requested name
exports.createRoom = function(playerName,UID){
	if(playerName == null){
		return {success: false, message: "Please enter a name."};
	}
	trimPlayer = playerName.trim();
	if(!isValidName(trimPlayer)){
		return {success: false, message: "Invalid name."};
	}
	//check if room name already exists
	var trimRoom, keep = true;
	/* Actually a miracle should never occur?
	while(keep){
		gamesCreated++;
		trimRoom = hashids.encode(gamesCreated + 1000000000);
		//Actually, a miracle should never occur?
		/*
		if(rooms[trimRoom] == null){
			//if a miracle occurs, get another id
			keep = false;
		}
	}
	*/
	gamesCreated++;
	trimRoom = hashids.encode(gamesCreated + 1000000000);
	rooms[trimRoom] = new gameRoom(trimRoom,trimPlayer,UID);
	console.log("Created room " + trimRoom + " with leader " + trimPlayer);
	return {success: true, roomName:trimRoom, playerName: trimPlayer};
}

//Returns object describing current rooms
//currently not necessary
/*
exports.getAllRoomData = function(){
	var toReturn = {};
	for (var room in rooms){
		toReturn[room]= {name: room, playerCount: rooms[room].players.length + rooms[room].waiting.length};
	}
	return toReturn;
}
*/

//Returns object with array of player names and the leader
exports.getPlayersIn = function(roomName){
	var theRoom = rooms[roomName];
	if(theRoom == null){
		return {success: false, message:"That room doesn't exist."};
	}
	var toReturn = {success: true};
	toReturn["roomName"] = roomName;
	toReturn["leader"] = theRoom.leader.name;
	toReturn["dealer"] = theRoom.dealer.name;
	toReturn["players"] = [];
	for(var i = 0; i < theRoom.players.length; i++){
		toReturn["players"].push(theRoom.players[i].name);
	}
	return toReturn; 
}

//playerName requests to join roomName
exports.joinRequest = function(playerName,UID, roomName){
	var theRoom = rooms[roomName];
	//check if room exits. this should just be for safety.
	if (theRoom == null){
		return {success: false, message:"That room does not exist."};
	}
	//full room
	if ((theRoom.players.length + theRoom.waiting.length) >= MAX_PLAYERS){
		return {success: false, message:"That room is full."};
	}
	if(playerName == null){
		return {success: false, message: "Please enter a name."};
	}
	var trimPlayer = playerName.trim();
	if(!isValidName(trimPlayer)){
		return {success: false, message: "Invalid name."};
	}
	if(getPlayer(theRoom,trimPlayer,true) != null){
		return {success: false, message:"Someone in that room already has that name."};
	}
	if(theRoom.gameState > GAME_NOT_STARTED){
		var toAdd = new gamePlayer(trimPlayer,UID);
		var prevData = theRoom.leaverData[trimPlayer];
		if(prevData){
			toAdd.score = prevData.score;
			toAdd.previousCards = prevData.previous;
			delete theRoom.leaverData[trimPlayer];
		}
		theRoom.waiting.push(toAdd);
		return {success: true, waiting: true, roomName: roomName, playerName:trimPlayer};
	}
	else{
		theRoom.players.push(new gamePlayer(trimPlayer,UID));
		console.log(playerName + " joined room " + theRoom.name);
		return {success: true, waiting: false, roomName: roomName, playerName:trimPlayer};
	}
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
	console.log(playerName + " left room " + theRoom.name);
	//no one left in room, so delete it
	if(theRoom.players.length == 0){
		console.log(theRoom.name + " was deleted");
		delete rooms[roomName];
		return {success: true, roomDeleted: true};
	}
	//need to find new leader
	if(theRoom.leader == thePlayer){
		theRoom.leader = theRoom.players[Math.floor(Math.random() * theRoom.players.length)];
		console.log(theRoom.leader.name + " is the new leader");
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
exports.startRequest = function(playerName,roomName,options){
	var theRoom = rooms[roomName];
	if(theRoom == null){
		return {success: false, message: "You are not in a room."};
	}	
	var thePlayer = getPlayer(theRoom,playerName,false);

	if(thePlayer == null){
		return {success: false, message: "You do not exist"};
	}
	if(theRoom.leader != thePlayer){
		return {success: false, message: "You are not the leader of your current room."};
	}
	if(theRoom.players.length < MIN_PLAYERS){
		return {success: false, message: "You need 3 players to play this game."};
	}
	if(theRoom.gameState != GAME_NOT_STARTED){
		return {success: false, message: "The game is already in progress."};
	}

	//Deal with the options
	if(decks[options['deckName']] == null){
		return {success: false, message: "That deck doesn't exist"};
	}
	if(options['time'] == '30'){
		theRoom.timeLimit = 30;
	}
	else if(options['time'] == '90'){
		theRoom.timeLimit = 90;
	}
	if(options['allowRedraw'] == 'yes'){
		theRoom.allowRedraw = true;
	}
	if(options['dealerFirstOrLast'] == 'first'){
		theRoom.dealerFirst = true;
	}
	//everything's fine, start the game
	console.log(theRoom.name + " has started playing with deck "+ options["deckName"]);
	initializeGame(theRoom,options["deckName"]);
	return {success: true, theRoom:theRoom.name};
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
exports.getStatements = function(roomName){
	//eventually check that this makes sense
	var theRoom = rooms[roomName];

	if(theRoom.round > ROUND_LIMIT){
		return false;
	}

	var result = {};
	var i,selected, theCard, thePlayer,possible;
	//the strategy: find all possible cards for that player
	//randomly pick one and assign it to that player
	//if there are no possible cards for a player, the game is over
	for(i = 0; i < theRoom.players.length; i++){
		thePlayer = theRoom.players[i];
		possible = [];
	       	for(var j = 0; j < theRoom.deck.length; j++){
			theCard = theRoom.deck[j];
			if(!theCard.inPlay && !theCard.discarded){
				if(theRoom.allowRedraw || (thePlayer.previousCards.indexOf(theCard) == -1)){
					possible.push(theCard);
				}
			}
		}
		if (possible.length == 0){
			return false;
		}
		theCard = possible[Math.floor(Math.random() * possible.length)];
		theCard.mostVotes = 0;
		theCard.leastvotes = 0;
		thePlayer.card = theCard;
		thePlayer.previousCards.push(theCard);
		theCard.inPlay = true;
		result[thePlayer.name] = {quote: theCard.masterCard.quote,
					  author: theCard.masterCard.author,
	       				  source: theCard.masterCard.source,
					  score: theCard.score};
	}
	console.log("Sent statements to " + theRoom.name);
	return result;
}

/*
function generateOrder(theRoom){
	var result = {};
	result["dealer"] = theRoom.dealer.name;
	result["order"] = [];
	for(var i = 0; i < theRoom.players.length; i++){
		result["order"].push(theRoom.players[i].name);
	}
	return result;
}
*/

//adjust the play order for the given room
exports.adjustOrder = function(roomName){
	//shouldn't have to check this, only called by the server
	var theRoom = rooms[roomName];
	var playerList = theRoom.players;
	//room leader is the first dealer
	if(theRoom.round == 1){
		theRoom.dealer = theRoom.leader;
		//move leader to first
		if(theRoom.dealerFirst){
			while(playerList[0] != theRoom.leader){
				playerList.push(playerList.shift());	
			}
		}
		else{
			while(playerList[playerList.length-1] != theRoom.leader){
				playerList.unshift(playerList.pop());
			}
		}
	}
	else{
		playerList.unshift(playerList.pop());
		if(theRoom.dealerFirst){
			theRoom.dealer = playerList[0]
		}
		else{
			theRoom.dealer = playerList[playerList.length-1];
		}
	}
	theRoom.whosUp = 0;
	return exports.getPlayersIn(roomName);
}

/*
//just get the order for a room
exports.getOrder = function(roomName){
	return generateOrder(rooms[roomName]);
}
*/

//only called when there is a request to make someone defend
exports.getWhosUp = function(roomName,playerName){
	var theRoom = rooms[roomName];
	var thePlayer = getPlayer(theRoom,playerName,false);
	if(thePlayer != theRoom.dealer){
		return false;
	}
	if(theRoom.gameState != GAME_BETWEEN_ARGUMENTS){
		return false;
	}
	if(theRoom.players[theRoom.whosUp] == null){
		return false;
	}
	theRoom.gameState = GAME_SOMEONE_ARGUING;
	return {player: theRoom.players[theRoom.whosUp].name,time: theRoom.timeLimit};
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
	console.log("Game in " + roomName + " is over.");
	return {player: wPlayer, playerScore: playerScore, card: wCard, cardScore: cardScore};
}

//playerID is done defending their statement
exports.doneDefending = function(roomName,playerName){
	var theRoom = rooms[roomName];
	if (theRoom == null){
		return {success: false, message: "You are not in a room."};
	}
	if (theRoom.gameState != GAME_SOMEONE_ARGUING){
		return {success: false, message: "It's not time for that."};
	}
	var thePlayer = getPlayer(theRoom,playerName,false);
	if(thePlayer == null){
		return {success: false, message: "You're not in that room."};
	}
	if(thePlayer != theRoom.players[theRoom.whosUp]){
		return {success: false, message: "It's not your turn."};
	}
	//player already voted
	if(thePlayer.voted){
		return {success: false, message: "You already said you were done."};
	}
	//okay, the vote matters
	theRoom.gameState = GAME_BETWEEN_ARGUMENTS;
	thePlayer.voted = true;
	theRoom.votesReceived++;
	theRoom.whosUp++;
	console.log(playerName + " is done defending");
	return {success:true, roomName:theRoom.name, votesNeeded: (theRoom.players.length - theRoom.votesReceived)};
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
