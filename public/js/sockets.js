// jshint -W117

var username = "";
var deckData;
var currentStatements;
var playerList;
var playerScores = {};
var meDefending = false;
var meDealer = false;
var gameOver = false;
var socket;

if(location.hostname.indexOf('wrongest.net') > -1){
  socket = io(location.hostname + ':8000');
}
else{
  socket = io();
}

socket.on('pausegame', function(){
  $('#GameView').addClass('hidden');
  $('#VotingBooth').addClass('hidden');
  $('#RoomSetup').removeClass('hidden');
  $('#pauseDiv').removeClass('hidden');
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
    $('#roomresult').text('Room created!');
    username = data.playerName;
    $('#roomLink').text(data.link);
    $('#roomURL').add('#pauseRoomURL').val(data.link);
    $('#createDiv').hide();
    $('#roomDiv').show();
    $('#startDiv').hide();
  }
  else{
    clearToast();
    $('#SetupToasts').append('<li class="alert">' + data.message + '</li>');
  }	
});

//received after emitting requestjoin
socket.on('joinresult',function(data){
  if(data.success){
    $('#joinDiv').hide();
    $('#roomDiv').show();
    $('#startDiv').hide();
    $('#roomURL').add('#pauseRoomURL').val(data.link);
    username = data.playerName;
    socket.emit('requestroomdata',data.roomName);
    if(data.waiting){
      $('#waitingDiv').removeClass('hidden');
      for(var i = 1; i <= 8; i++){
        $('#player'+i).addClass('has-score');
        $('#player'+i).append('<span class="player-score" id="playerScore' + i + '"></span>');
      }
    }
  }
  else{
    clearToast();
    $('#SetupToasts').append('<li class="alert">' + data.message + '</li>');
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
socket.on('updatecurrentroom', function(players, leader, dealer){
  playerList = players;
  var $toChange = $('#joinRoomMembers').add('#pauseRoomMembers').add('#detailsRoomMembers');
  var $theDiv;
  $toChange.empty();

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
    if ($theDiv.hasClass('has-score')){
      var theScore = playerScores[players[i]];
      if (theScore === null) {theScore = 0;}
      $('#playerScore' + (i+1)).empty().append(theScore);
    }
  }
  for(var i = players.length+1; i <=8; i++){
    $('#player' + i).addClass('hidden');
  }
  if(leader == username){
    $('.admin-options').show();
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
    $('.admin-options').hide();
    $('#restartOption').addClass('hidden');
  }
  if(dealer == username){
    meDealer = true;
    $('#dealerControls').show();
  }
  else{
    meDealer = false;
    $('#dealerControls').hide();
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
  currentStatements = data;
  if( $('#VotingBooth').hasClass('hidden')){
    $('#roomDiv').hide();
    $('#waitingDiv').addClass('hidden');
    $('#RoomSetup').addClass('hidden');
    $('#GameView').removeClass('hidden');
    $('#orderDiv').show();
  }
});

socket.on('timetodefend',function(player,time){
  if(player == username){
    meDefending = true;
    $('#defendDiv').show();
    $('#orderDiv').hide();
    var myStatement = currentStatements[username];
    $('#statementDiv').empty().text(myStatement.quote);
    if(myStatement.score < -1){
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
  startTimer();
  $('.knob-holder').removeClass('hidden');
});

//received when anyone in the room says they are done defending
//data is the # of people who are not done
socket.on('newdefendcount',function(newCount,stopClock){
  if(stopClock){
    window.clearInterval(clockTick);
    $('.knob-holder').addClass('hidden');
  }
  if(meDealer){
    $('#dealerControls').show();
  }
  $('#orderDiv').show();
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
  }
  else{
    //$('#orderDiv').hide();
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
    $('input[Value="LeastWrong"]').prop('checked',false);
    $('input[Value="MostWrong"]').prop('checked',false);
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

//received when someone else in the same room has voted
socket.on('receivevote', function(data){
  $('#voteResult').show();
  var whoVoted = data.voter;
  var most = data.mostName;
  var least = data.leastName;
});

//received at the end of a round
socket.on('roundend', function(data){
  //Next line temporarily commented out by Dole
  //$('#ScoreSheet').removeClass('hidden');
  //$('#scoreDiv').show();
  var gameData = data.gameData;
  var playerData = data.playerData;

  //After the first round, add the spans to display score
  if(gameData.round == 1){
    for(var i = 1; i <=8; i++){
      $('#player' + i).addClass('has-score');
      $('#player' + i).append('<span class="player-score" id="playerScore' + i + '"></span>');
    }
  }

  var theName, row = 0, changeString;
  //reset player div colors and show score changes
  for(var i = 1; i <= playerList.length; i++){
    $('#player' + i).removeClass('completed');
    theName = playerList[i-1];
    changeString = playerData[theName].scoreChange === 0 ? '' : ('+' + playerData[theName].scoreChange);
    playerScores[theName] = playerData[theName].newScore;
    if(theName == username){
      $('#MyScoreChange').empty().append(changeString);
      continue;
    }
    row++;
    $('#ScoreChange' + row).empty().append(changeString);
  }
  //Reset Voting Booth colors.
  $('#VotingBooth tr').removeClass('most-wrong least-wrong');
  $('#WaitingAtBoothBecause').text('Round ' + gameData.round + ' complete! Next round begins in 7 seconds.');
  $('#VotingBooth').toggleClass('show-scores');
  setTimeout(function(){
    $('#WaitingAtBoothBecause').text('').addClass('hidden');
    $('#VotingBooth').toggleClass('show-scores');
    $('#VotingBooth').addClass('hidden');
    if (!gameOver){
      $('#GameView').removeClass('hidden');
    }
    else{
      $('#GameOverScreen').removeClass('hidden').siblings('section').addClass('hidden'); 
    }
  },7000);
});

socket.on('gameover', function(data){
  gameOver = true;
  var scoresArray = [];
  for(var i = 0; i < playerList.length; i++){
    scoresArray.push( {name: playerList[i] , score: playerScores[playerList[i]]} );
  }
  scoresArray.sort( function (a,b){
    return b.score - a.score;
  });
  for(var i = 0; i < playerList.length; i++){
    $('#place' + (i+1)).removeClass('hidden');
    $('#namePlace' + (i+1)).text(scoresArray[i].name);
    $('#scorePlace' + (i+1)).text(scoresArray[i].score);
  }
  for(i++; i <=8; i++){
    $('#place' + i).addClass('hidden');
  }
  $('#WrongestQuote').text(data.card);
  $('#WrongestScore').text(data.cardScore);
});
