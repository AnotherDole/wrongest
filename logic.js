/*
 * Game logic for The Wrongest Words
 */

//should probably use a database for that at some point
var players = {}, rooms = {};

var MIN_PLAYERS = 3;
var MAX_PLAYERS = 8;

var GAME_NOT_STARTED = 0;
var GAME_WAITING_ARGUMENTS = 1;
var GAME_WAITING_VOTES = 2;
var GAME_FINISHED = 3;

exports.reset = function(){
	players = {};
	rooms = {};
}

function gamePlayer(name){
	this.name = name;
	this.room = null;
	this.score = 0;
	this.cardNum = 0;
	this.voted = false;
}

function gameRoom(name, leaderID){
	this.name = name;
	this.leader = leaderID;
	this.players = [leaderID];
	this.gameState = GAME_NOT_STARTED;
	this.roundNumber = 0;
	this.votesReceived = 0;
	this.deck = [];
}

function card(number, quote, author, episode) {
        this.number=number;
        this.quote=quote;
        this.author=author;
        this.episode=episode;
        this.inplay=false;
        this.played=false;
        this.discarded=false;
        this.rightcount=0;
        this.wrongcount=0;
        this.score=0;
        this.votesagainst=0;
        this.votesfor=0;
}

function initializeGame(gameRoom) {
	var i;
	//reset player data
	for (i=0; i < gameRoom.players.length; i++){
		players[gameRoom.players[i]].score=0;
		players[gameRoom.players[i]].cardNum=0;
		players[gameRoom.players[i]].voted = false;
	}
	gameRoom.deck = [ 
	new card(1,"Clowns are sexy.", "Sofonda Silicone", 113),
    	new card(2,"Not being turned on by bugs is unnatural", "Bugger", 95),
    	new card(3,"Liverpool fc is the best football team ever","lukepa",90),
    	new card(4,"JRR Tolkein might have been into mudding","Lomax",82),
    	new card(5,"We don't know what makes people fat","unattributed",89),
    	new card(6,"Slavery did not exist in America","Free Free",79),
    	new card(7,"I was having sex with my ladyfriend and we're both prego","Snuffleboo",79),
    	new card(8,"A boy gets married with a girl and they both can't hump","234567890",79),
    	new card(9,"Car never change since automobile invention","Thien63",94),
    	new card(10,"I am fully capable of going backwards and forwards in time and at will","Deus Ex Machina 42",75),
    	new card(11,"The first polio vaccine, the Salk vaccine, was a total disaster","mamakay",92),
    	new card(12,"The formation of planets is a lie. Climate science is a lie.","mnemeth1",75),
    	new card(13, "Two-Dimoensional love is controversial, yet not psychologically, philosophically or biologically wrong","anonymous",74),
    	new card(14,"Interpreters say there is no difference between night dreams and daytime dreams except about elephant.","Varzandeh",73),
    	new card(15,"[Dolphins] know how to access multiple dimensions.","Joan Ocean",65),
    	new card(16,"It is legal to post nude photos of someone without their consent","unattributed",64),
    	new card(17,"Laura Ingalls Wilder is God.","John Charles Wilson",30),
    	new card(18,"Disney’s Roadside Romeo has opened in India and it’s a huge hit. Let me repeat that: It’s a HUGE HIT.","Amid Amidi",36),
    	new card(19,"Frozen cum is a refreshing summer treat","cumpantyboy",63),
    	new card(20,"A beautiful woman is like a wild horse; she will need to be tamed before you can enjoy each other’s company.","ewokdisco",35),
    	new card(21,"a toilet is becoming a completely foreign object to women.","antifeministtech.info",103),
    	new card(22,"I think the logical thing is for the company to provide the male bosses with a prostitution expense account","unattributed",103),
    	new card(23,"Obama told children to take away my money","TigerMegatron",9),
    	new card(24,"polio (the actual polio virus) was never the plague it was made out to be.","mamakay",92),
    	new card(25,"The Kardashians are in league with Al-Qaeda","Johnathan Lee Riches",80),
    	new card(26,"many bad boys are overweight or otherwise physically unattractive.","Love Shy Wiki",114),
    	new card(27,"The Latino people have never had a revolution","femalepharoe",75),
    	new card(28,"Che Guevara failed spectacularly at everything he attempted in his life.","Conservapedia",15),
    	new card(29,"Homosexual bait-and-switch is a technique used by covert homosexuals to convert heterosexuals to homosexuality, using deceit and powerful mind-control techniques.","GeorgeE",15),
    	new card(30,"Light creates gravity. Since photons from the sky do not have mass their bombardment doesn't hurt, but they don't let you jump very high either.","Smithjustinb",75),
    	new card(31,"Elisha Cuthbert has to pee sometimes, and that's hot.","Spurting",84),
    	new card(32,"I want to punch a hippo right there in the face. He wouldn't even feel it, but I'd feel fuckin' ace.","nevski pazza",85),
    	new card(33,"In alternate universes, mirror images of yourself are living out their lives, just as you are.","Burt Goldman",104),
    	new card(34,"Everything will be okay if you just let me yiff the otter.","nekobe",100),
    	new card(35,"Light is the most basic corrosive we know","theRhenn",35),
    	new card(36,"Pour vegetable oil and flour into a baking dish and microwave at 70% power for 6 minutes. This will create a white roux","flatscat",26),
    	new card(37,"There is a way you can be a wizard in reality.","wikihow",44),
    	new card(38,"Most people are not intellectual enough to understand Family Guy, making it superior.",90),
    	new card(39,"The smell of fresh pee isn't nasty and the residual dry smell is like a perfume.","Humidresearcher",52),
    	new card(40,"Forums are like the herpes of the internet","WillieDangDoodle",108),
    	new card(41,"There is no such thing as a “best” when it comes to sports or sports teams. It would take away the ability of people to have opinions.","Bangbangcoconut",90),
    	new card(42,"Gucci Mane best rapper alive","youtube",0),
    	new card(43,"The urinal is just for you as a man. It's impossible for her to use it.","The Spearhead",103),
    	new card(44,"As of 2002, love went extinct","Msshardy",109),
    	new card(45,"Being a juggalo is just like being a normal person","unattributed",21),
    	new card(46, "Warhammer 40,000 can make anything awesome.", "this troper", 60),
    	new card(47,"There's nothing perverted about sniffing a pretty girl's seatcushon","quaps",66),
    	new card(48,"Minors find it difficult to masturbate.","AWOL",115),
    	new card(49,"Man used to live for hundreds of years disease free.","winddance",38)];
	gameRoom.gameState = GAME_WAITING_ARGUMENTS;
}

//Register playerID's name as playerName
exports.addPlayer = function(playerName, playerID){
	var reqName = playerName.trim();
	if (reqName.length < 3){
		return {success: false, message: "Your name must be longer than 2 characters"};
	}
	//check if that playerID has already signed on
	if(players[playerID] != null){
		return {success: false, message: "You have already chosen a name."};
	}
	//check if that name already exists
	for(var player in players){
		if(players[player].name == reqName){
			return {success:false, message: "Someone else has that name."};
		}
	}
	var newplayer = new gamePlayer(reqName);
	players[playerID] = newplayer;
	console.log('Added player ' + reqName);
	return {success:true, name:reqName};
}

//Create a new room. playerID is the requestor, name is requested name
exports.createRoom = function(playerID,thename){
	//check if player has chosen a name yet
	var thePlayer = players[playerID];
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
	//check if room name already exists
	if(rooms[reqname] != null){
		return {success: false, message:"A room with that name already exists"};
	}
	rooms[reqname] = new gameRoom(reqname,playerID);
	players[playerID].room = reqname;
	console.log("Created room " + reqname + " with leader " + thePlayer.name);
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
	toReturn["leader"] = players[theRoom.leader].name;
	toReturn["players"] = [];
	for(var i = 0; i < theRoom.players.length; i++){
		toReturn["players"].push(players[theRoom.players[i]].name);
	}
	return toReturn; 
}

//playerID requests to join roomName
exports.joinRequest = function(playerID, roomName){
	var thePlayer = players[playerID];
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
	thePlayer.room = roomName;
	theRoom.players.push(playerID);
	console.log(thePlayer.name + " joined room " + theRoom.name);
	return {success: true};
}

//playerID requests to leave their current room
exports.leaveRequest = function(playerID){
	//to be safe
	var thePlayer = players[playerID];
	if(thePlayer == null){
		return {success: false, message: "Player does not exist"};
	}	
	var theRoom = rooms[thePlayer.room];
	if(theRoom == null){
		return {success: false, message: "Player is not in a room."};
	}
	theRoom.players.splice(theRoom.players.indexOf(playerID),1);
	console.log(thePlayer.name + " left room " + theRoom.name);
	//no one left in room, so delete it
	if(theRoom.players.length == 0){
		console.log(theRoom.name + " was deleted");
		delete rooms[thePlayer.room];
		thePlayer.room = null;
		return {success: true, roomDeleted: true};
	}
	thePlayer.room = null;
	//need to find new leader
	if(theRoom.leader == playerID){
		theRoom.leader = theRoom.players[Math.floor(Math.random() * theRoom.players.length)];
		console.log(players[theRoom.leader].name + " is the new leader");
	}
	return {success: true, roomDeleted: false, theRoom:theRoom.name};
}

exports.disconnect = function(playerID){
	var result = exports.leaveRequest(playerID);
	delete players[playerID];
	return result;
}

//playerID requests to start the room they are leading
exports.startRequest = function(playerID){
	var thePlayer = players[playerID];
	if(thePlayer == null){
		return {success: false, message: "You do not exist"};
	}
	var theRoom = rooms[thePlayer.room];
	if(theRoom == null){
		return {success: false, message: "You are not in a room."};
	}
	if(theRoom.leader != playerID){
		return {success: false, message: "You are not the leader of your current room."};
	}
	if(theRoom.players.length < 3){
		return {success: false, message: "You need 3 players to play this game."};
	}
	if(theRoom.gameState != GAME_NOT_STARTED){
		return {success: false, message: "The game is already in progress."};
	}
	//everything's fine, start the game
	console.log(theRoom.name + " has started playing.");
	initializeGame(theRoom);
	return {success: true, theRoom:theRoom.name};
}

//return an object containing all the the statements
//assigned to the players in the room.
exports.getStatements = function(roomName){
	//eventually check that this makes sense
	var theRoom = rooms[roomName];
	var selectedCards = [];
	var i,selected;
	var result = {};
	for(i = 0; i < theRoom.players.length; i++){
		var keep = true;
		while(keep){
			selected = Math.floor(Math.random() * theRoom.deck.length);
			if(selectedCards.indexOf(selected) == -1){
				keep = false;
				selectedCards.push(selected);
				players[theRoom.players[i]].cardNum = selected;
				var playerName = players[theRoom.players[i]].name;
				result[playerName] = {
					playerNum: (i+1),
					quote: theRoom.deck[selected].quote,
					author: theRoom.deck[selected].author,
					episode: theRoom.deck[selected].episode,
					score: theRoom.deck[selected].score
				};
			}
		}
	}
	console.log("Sent statements to " + theRoom.name);
	return result;
}

//playerID is done defending their statement
exports.doneDefending = function(playerID){
	var thePlayer = players[playerID];
	//i hate having to do this
	if (thePlayer == null){
		return {success: false, message: "You don't exist."};
	}
	var theRoom = rooms[thePlayer.room];
	if (theRoom == null){
		return {success: false, message: "You are not in a room. Stop fucking with me."};
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
	console.log(thePlayer.name + " is done defending");
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

exports.processVote = function(playerID,mostWrong,leastWrong){
	var thePlayer = players[playerID];
	if (thePlayer == null){
		return {success: false};
	}
	var theRoom = rooms[thePlayer.room];
	if(theRoom == null){
		return {success: false};
	}
	if(theRoom.gameState != GAME_WAITING_VOTES){
		return {success:false};
	}
	if(thePlayer.voted){
		console.log("Player " + thePlayer.name + " tried to commit voter fraud.");
		return {success: false, message: "You already voted."};
	}
	if(mostWrong == leastWrong){
		return {success: false, message: "You must vote for different players."};
	}
	var mostPlayer = players[theRoom.players[mostWrong-1]];
	var leastPlayer = players[theRoom.players[leastWrong-1]];
	if(mostPlayer == null || leastPlayer == null){
		return {success: false, message: "Invalid player numbers."};
	}
	if(mostPlayer == thePlayer || leastPlayer == thePlayer){
		return {success: false, message: "You cannot vote for yourself"};
	}
	var mostCard = theRoom.deck[mostPlayer.cardNum];
	var leastCard = theRoom.deck[leastPlayer.cardNum];
	thePlayer.voted = true;
	theRoom.votesReceived++;
	console.log("Player " + thePlayer.name + " votes: most is " + mostPlayer.name + ", least is " + leastPlayer.name);
	return { success: true, roomName: theRoom.name, voter: thePlayer.name, mostNum: mostWrong,
	       		mostName: mostPlayer.name, leastNum: leastWrong, leastName: leastPlayer.name};
}
