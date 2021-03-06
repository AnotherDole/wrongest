// jshint -W117

var username = "";
var deckData = null;
var currentStatements = null;
//playerList and playerScores are parallel arrays
var playerList = [];
var playerScores = [];
var meDefending = false;
var meDealer = false;
var meWaiting = false;
var gameOver = false;
var socket = null;

function createSocket(){
  if (socket !== null){
    return;
  }
  if(location.hostname.indexOf('wrongest.net') > -1){
    socket = io(location.hostname + ':8000');
  }
  else{
    socket = io();
  }

  socket.on('reconnect',function(){
    $('#roomDiv').addClass('hidden');
    $('#GameView').addClass('hidden');
    $('#GameClockHolder').addClass('hidden');
    $('#defendDiv').addClass('hidden');
    $('#VotingBooth').addClass('hidden');
    $('#RoomSetup').removeClass('hidden');
    $('#startDiv').removeClass('hidden');
    $('.create-or-join').removeClass('hidden');
    $('#CreateGameRow').addClass('hidden');
    $('.split-row').addClass('hidden');
    $('#JoinWithCodeRow').removeClass('hidden').addClass('chosen');
    $('.create-or-join .row.chosen input').fadeIn(300);
    $('#joinUsernameInputAlt').val(username);
    $('.button-holder').removeClass('hidden');
    makeToast('setup','alert','Click join to rejoin your game.');
  })
  
  socket.on('reconnecting',function(){
    $('#roomDiv').addClass('hidden');
    $('#GameView').addClass('hidden');
    $('#GameClockHolder').addClass('hidden');
    $('#defendDiv').addClass('hidden');
    $('#VotingBooth').addClass('hidden');
    $('#RoomSetup').removeClass('hidden');
    $('#startDiv').removeClass('hidden');
    $('.create-or-join').removeClass('hidden');
    $('#CreateGameRow').addClass('hidden');
    $('.split-row').addClass('hidden');
    $('#JoinWithCodeRow').removeClass('hidden').addClass('chosen');
    $('.create-or-join .row.chosen input').fadeIn(300);
    $('#joinUsernameInputAlt').val(username);
    $('.button-holder').addClass('hidden');
    makeToast('setup','alert','Sorry, you got disconnected from the game. When you are reconnected, you can rejoin your game.');
  })

  socket.on('pausegame', function(){
    $('#roomDiv').addClass('hidden');
    $('#GameView').addClass('hidden');
    $('#GameClockHolder').addClass('hidden');
    $('#defendDiv').addClass('hidden');
    $('#VotingBooth').addClass('hidden');
    $('#RoomSetup').removeClass('hidden');
    $('#pauseDiv').removeClass('hidden');
    $('.button-holder').removeClass('hidden');
  });

  //received after creating or joining a room
  socket.on('deckdata',function(data){
    deckData = data;
    $('#deck').empty();
    for(var deck in data){
      $('#deck').append($('<option/>', {text: deck, value: deck}));
    }
    updateDeckDescription();
  });

  //received after emitting createroom
  socket.on('createresult',function(data){
    if(data.success){
      username = data.playerName;
      $('input[data-holds="roomCode"]').val(data.roomName);
      $('input[data-holds="roomURL"]').val(data.link);
      $('#createDiv').addClass('hidden');
      $('.create-or-join').addClass('hidden');
      $('.create-screen').removeClass('hidden');
      $('#roomDiv').removeClass('hidden');
      $('#startDiv').addClass('hidden');
      history.pushState({}, 'room '+data.roomName, '/'+data.roomName);
      if (gaTracking === true) {
        ga('send', 'pageview', '/'+data.roomName);
      }
      console.log(socket.id);
    }
    else{
      makeToast('setup', 'alert', data.message);
    }	
  });

  //received after emitting requestjoin
  socket.on('joinresult',function(data){
    if(data.success){
      $('#joinDiv').addClass('hidden');
      $('#roomDiv').removeClass('hidden');
      $('#startDiv').addClass('hidden');
      $('input[data-holds="roomCode"]').val(data.roomName);
      $('input[data-holds="roomURL"]').val(data.link);
      history.pushState({}, 'room '+data.roomName, '/'+data.roomName);
      if (gaTracking === true) {
        ga('send', 'pageview', '/'+data.roomName);
      }
      username = data.playerName;
      if(data.waiting){
	meWaiting = true;
	$('#waitingDiv').removeClass('hidden');
	$('.admin-options').addClass('hidden');
      }
      console.log(socket.id);
    }
    else{
      makeToast('setup','alert',data.message);
    }
  });

  //received after leaving a room
  socket.on('leaveresult',function(data){
    if(data.success){
      username = false;
      $('#roomDiv').hide();
      $('#orderDiv').hide();
      $('#statementsDiv').hide();
      $('#voteResult').hide();
      $('#startDiv').show();
    }	
  });

  //received whenever someone in the current room leaves or joins
  socket.on('updatecurrentroom', function(players, leader, dealer, scores){
    playerList = players;
    playerScores = scores;
    var $toChange = $('#joinRoomMembers').add('#pauseRoomMembers').add('#detailsRoomMembers');
    var $theDiv;
    $toChange.empty();

    if(scores === null){
      $('.has-score').removeClass('has-score');
      for(var i = 1; i <= 8; i++){
	$('#playerScore' + i).empty();
      }
    }

    $toChange.append('Currently in the room:');
    for (var i = 0; i < players.length; i++){
      if(players[i] == leader){
	$toChange.append('<li class="leader">'+players[i]+'</li>');
      } else {
	$toChange.append('<li>'+players[i]+'</li>');
      }
      $theDiv = $('#player' + (i+1)).removeClass('hidden');
      if(players[i] == dealer){
	$theDiv.addClass('dealer');
      }
      else{
	$theDiv.removeClass('dealer');
      }
      $('#playerName' + (i+1)).empty().append(players[i]);
      if (scores !== null){
	$theDiv.addClass('has-score');
	$('#playerScore' + (i+1)).empty().append(scores[i]);
      }
    }
    for(var i = players.length+1; i <=8; i++){
      $('#player' + i).addClass('hidden');
    }
    if(leader == username){
      $('.admin-options').removeClass('hidden');
      $('#restartOption').removeClass('hidden');
      if (players.length < 3){
	$('#RestartButton').addClass('hidden');
	$('#RestartGameBother').removeClass('hidden');
	$('#StartGameButton').addClass('hidden');
	$('#StartGameBother').removeClass('hidden');
      } else {
	$('#RestartButton').removeClass('hidden');
	$('#RestartGameBother').addClass('hidden');
	$('#StartGameButton').removeClass('hidden');
	$('#StartGameBother').addClass('hidden');
      }
    }
    else{
      $('.admin-options').addClass('hidden');
      $('#restartOption').addClass('hidden');
    }
    if(dealer == username){
      meDealer = true;
      //this happens if somone leave while someone else is defending
      if($('#GameClockHolder').hasClass('hidden')){
        $('#dealerControls').removeClass('hidden');
      }
    }
    else{
      meDealer = false;
      $('#dealerControls').addClass('hidden');
    }	
    $('.on-deck').removeClass('on-deck');
    $('.player-tease').empty();
    if(playerList[0] == username && !$('#player1').hasClass('completed') && currentStatements !== null){
      var myStatement = currentStatements[username].quote;
      $('#player1').addClass('on-deck');
      $('#playerTease1').text(makeStatementTeaser(myStatement));
    }
  });

  socket.on('startresult', function(data){
    if(data.success){
      $('#startresult').text('Game Started');
      $('#RoomSetup').addClass('hidden');
      $('#GameView').removeClass('hidden');
    }
    else{
      $('#startresult').text(data.message);
    }
  });

  //Receive the statments that everyone will be defending this round.
  //Automatically sent out at the start of a new round
  socket.on('getstatements', function(data){
    meWaiting = false;
    gameOver = false;
    currentStatements = data.cardData;
    $('#currentRound').text(data.round);
    $('#roundLimit').text(data.roundLimit);
    if( $('#VotingBooth').hasClass('hidden')){
      $('#roomDiv').addClass('hidden');
      $('#waitingDiv').addClass('hidden');
      $('#RoomSetup').addClass('hidden');
      $('#pauseDiv').addClass('hidden');
      $('#GameView').removeClass('hidden');
      $('#orderDiv').removeClass('hidden');
      $('#GameOverScreen').addClass('hidden');
    }
  });

  socket.on('timetodefend',function(player,time){
    if(meWaiting) { return; }
    if(player == username){
      meDefending = true;
      $('#defendDiv').removeClass('hidden');
      $('#orderDiv').addClass('hidden');
      $('#EarlyButtonHolder').removeClass('hidden');
      var myStatement = currentStatements[username].quote.replace('{','<span class="revealed">').replace('}','</span>');
      $('#statementDiv').empty().append(myStatement);
      if(currentStatements[username].score < -1){
	$('#HardCardSticker').removeClass('hidden');
      }
      else{
	$('#HardCardSticker').addClass('hidden');
      }
    }	
    //find first li that isn't completed, make it active
    for(var i = 1; i <=8; i++){
      if(!$('#player' + i).hasClass('completed')){
	$('#player' + i).addClass('active');
	break;
      }
    }
    startTimer(time);
    $('.current-round').addClass('hidden');
    $('.knob-holder').removeClass('hidden');
  });

  //received when anyone in the room says they are done defending
  //data is the # of people who are not done
  socket.on('newdefendcount',function(newCount,stopClock){
    if(meWaiting) return;
    if(stopClock){
      window.clearInterval(clockTick);
      $('.knob-holder').addClass('hidden');
      $('.current-round').removeClass('hidden');
    }
    if(!meDefending){
      if(meDealer && stopClock){
	$('#dealerControls').removeClass('hidden');
      }
      $('#orderDiv').removeClass('hidden');
    }
    if(newCount > 0){
      var playersDone = playerList.length - newCount;
      for(var i = 1; i <= 8; i++){
	if(i <= playersDone){
	  $('#player' + i).addClass('completed');
	}
	else{
	  $('#player' + i).removeClass('completed');
	}
      }
      if(playerList[playersDone] == username){
	var myStatement = currentStatements[username].quote;
	var num = playersDone + 1;
	$('#player' + num).addClass('on-deck');
	$('#playerTease' + num).text(makeStatementTeaser(myStatement));
      }
      else{
	$('.on-deck').removeClass('on-deck');
	$('.player-tease').empty();
      }
    }
    else{
      $('.on-deck').removeClass('on-deck');
      $('.player-tease').empty();
      //$('#orderDiv').hide();
      if(!$('#VotingBooth').hasClass('hidden')){
	makeToast('vote','info','Someone left the room. Please vote again.');
      }
      $('#GameView').addClass('hidden');
      $('#VotingBooth').removeClass('revealed show-scores');
      $('#SubmitVotes').removeClass('hidden');
      $('#VotingOptions').shuffle();
      $('#WaitingAtBoothBecause').text('').addClass('hidden');
      $('#VotingBooth').removeClass('hidden');
      $('#VotingBooth').children().removeClass('chosen');
      $('#SendVotesButton').addClass('hidden');
      $('#voteResult').empty();
      $('.button-holder').addClass('hidden');
      $('.most-wrong').removeClass('most-wrong');
      $('.least-wrong').removeClass('least-wrong');
      $('input[Value="MostWrong"]').prop('checked',false);
      $('input[Value="LeastWrong"]').prop('checked',false);
      updateVoteSelectors();
    }
    $('.active').removeClass('active');
  });

  //received if your attempt to say you are done voting failed for some reason
  socket.on('donefailed',function(data){
    $('#votestatus').text(data);
  });

  //received if the submitted votes were invalid
  socket.on('votefailed', function(data){
    $('#voteResult').append(data + "<br>");	
  });

  //received at the end of a round
  socket.on('roundend', function(data){
    //Next line temporarily commented out by Dole
    //$('#ScoreSheet').removeClass('hidden');
    //$('#scoreDiv').show();
    var gameData = data.gameData;
    var playerData = data.playerData;

    var theName, row = 0, changeString;
    //reset player div colors and show score changes
    for(var i = 1; i <= playerList.length; i++){
      $('#player' + i).removeClass('completed');
      theName = playerList[i-1];
      changeString = playerData[theName].scoreChange === 0 ? '' : ('+' + playerData[theName].scoreChange);
      if(theName == username){
	$('#MyScoreChange').empty().append(changeString);
	continue;
      }
      row++;
      $('#ScoreChange' + row).empty().append(changeString);
    }
    //Reset Voting Booth colors.
    $('#VotingBooth tr').removeClass('most-wrong least-wrong');
    // NEXT ROUND TIMER....
    var nextRoundIn = 8;
    var nextRoundInMS = (nextRoundIn * 1000);
    var nrs = nextRoundIn;
    $('#WaitingAtBoothBecause').html('<span class="next-round-in">Next round in </span> <input class="tiny-knob knobtext" type="text" value="'+nextRoundIn+'" data-max="'+nextRoundIn+'" data-bgcolor="#eae6e6" data-fgcolor="#7a6969" data-inputcolor="#7a6969" data-min="0" data-width="48" data-height="48" />');
    $('.tiny-knob').knob();
    $('#VotingBooth').toggleClass('show-scores');
    var nextRoundClock = setInterval(function(){ 
      nrs--;
      $('.tiny-knob').val(nrs).trigger('change');
    }, 1000);
    setTimeout(function(){
      window.clearInterval(nextRoundClock);
      $('#WaitingAtBoothBecause').text('').addClass('hidden');
      $('#VotingBooth').toggleClass('show-scores');
      $('#VotingBooth').addClass('hidden');
      if (!gameOver){
	$('#GameView').removeClass('hidden');
      }
      else{
	$('#GameOverScreen').removeClass('hidden').siblings('section').addClass('hidden'); 
      }
    },nextRoundInMS);
  });

  socket.on('gameover', function(card,cardScore,players,finalPlayerList,finalScores){
    gameOver = true;
    var scoresArray = [], i;
    for(i = 0; i < finalPlayerList.length; i++){
      scoresArray.push( {name: finalPlayerList[i] , score: finalScores[i]} );
    }
    scoresArray.sort( function (a,b){
      return b.score - a.score;
    });
    placeClasses=["first-place","second-place","third-place","fourth-place","fifth-place","sixth-place","seventh-place","eighth-place"];
    var p=0;
    for(i = 0; i < finalPlayerList.length; i++){
      $('#place' + (i+1)).removeClass('hidden');
      $('#namePlace' + (i+1)).text(scoresArray[i].name);
      $('#scorePlace' + (i+1)).text(scoresArray[i].score);
      if (i < 1) {
	// first-place
      } else if (scoresArray[i].score !== scoresArray[i-1].score) {
	p++;
      }
      $('#place' + (i+1)).addClass(placeClasses[p]);
    }
    for(i++; i <=8; i++){
      $('#place' + i).addClass('hidden');
    }
    var wrongestwordsofthegame = card.replace('{','').replace('}','');
    $('#WrongestQuote').text(wrongestwordsofthegame);
    $('#WrongestScore').text(cardScore);
    var playerString = '';
    if(players.length == 1){
      playerString = players[0];
    }
    else if (players.length == 2){
      playerString = players[0] + ' and ' + players[1];
    }
    else{
      for (i = 0; i < players.length - 1; i++){
	playerString = playerString + players[i] + ', ';
      }
      playerString = playerString + 'and ' + players[i];
    }
    $('#WrongestCite').text(playerString);
    
    if(meDealer){
      var topPlayerScore = parseInt($('#scorePlace1').text());
      if (gaTracking === true) {
        ga('send', 'event', { eventCategory: 'Wrongest Words of the Game', eventAction: wrongestwordsofthegame, eventLabel: cardScore });
        ga('send', 'event', { eventCategory: 'end game', eventAction: 'players', eventLabel: finalPlayerList.length });
        ga('send', 'event', { eventCategory: 'Top Score', eventAction: 'top score', eventLabel: topPlayerScore });
      }
    }
    
  });
}
