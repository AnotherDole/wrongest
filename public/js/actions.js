// jshint -W117
/////////////////////////////////////////////////
// SETUP ACTIONS
////////////////////////////////////////////////

$('.room-pick').click(function() {
  $(this).parent().parent().addClass('chosen');
  $(this).parent().parent().siblings('.row').addClass('hidden');
  $('.create-or-join .row.chosen input').fadeIn(300);
  $('.create-or-join .row.chosen input:first-child').focus();
});

$('#JoinRoomButtonWithCode').click(function() {
  socket.emit('requestjoin',$('#joinUsernameInputAlt').val(),$('#joinRoomCode').val());
});

$('#CreateRoomButton').click(function() {
  $('.create-or-join').addClass('hidden');
  $('.create-screen').removeClass('hidden');
});

$('#JoinRoomButton').click(function() {
  $('.lead-in').addClass('hidden');
  $('.create-or-join').addClass('hidden');
  $('.join-screen').removeClass('hidden');
});

  // We wanna trigger the join or create buttons upon hitting Enter 
$('#createUsernameInput').keyup(function(e) {
  if(e.keyCode == 13){
    $("#CreateRoomButton").click();
  }
});

$('#joinUsernameInputAlt').keyup(function(e) {
  if(e.keyCode == 13){
    $("#JoinRoomButtonWithCode").click();
  }
});

$('input[data-holds="roomURL"], input[data-holds="roomURL"]').click(function() {
  this.selectionStart=0;
  this.selectionEnd=this.value.length;
  return false;
});

$('.settings-toggle').click(function() {
  $(this).children('.icon').toggleClass('spin');
  $(this).siblings('dd').slideToggle(500);
});

$('#StartGameButton').click(function(){
  var v = playerList.length;
  ga('send', 'event', { eventCategory: 'start game', eventAction: 'players', eventLabel: v });
  socket.emit('requeststart',
    $('#deck').val(),
    $('#timeLimit').val(),
    $('#allowRedraw').val(),
    $('#dealerSelect').val()
  );
});

if(location.pathname.length > 1){
  var theCode = location.pathname.substr(1);
  $('#JoinWithCodeRow').addClass('chosen');
  $('#JoinWithCodeRow').siblings('.row').addClass('hidden');
  $('.create-or-join .row.chosen input').fadeIn(300);
  $('#joinUsernameInputAlt').focus();
  $('#joinRoomCode').val(theCode);
}


/////////////////////////////////////////////////
// GAMEPLAY ACTIONS
////////////////////////////////////////////////

$('#DoneEarlyButton').click(function() {
  window.clearInterval(clockTick);
  ga('send', 'event', { eventCategory: 'defended', eventAction: 'done early', eventLabel: timer.total });
  donedefend();
});

$('.least-wrong-button').click(function() {
  $(this).toggleClass('active');
  if ( $(this).hasClass('active') ) {
    $r = $(this).parent().parent().parent();
    $l = $(this).parent().parent().siblings('.votebutton').children('label');
    $(this).siblings('input').prop('checked',true);
    $r.addClass('least-wrong');
    // remove the least wrong property on this row's siblings.
    $r.siblings('tr').removeClass('least-wrong');
    $r.siblings('tr').find('input[value="LeastWrong"]').prop('checked', false);
    $r.siblings('tr').find('.least-wrong-button').removeClass('active');
    if ( $r.hasClass('most-wrong') ) {
      $r.removeClass('most-wrong');
      $l.children('input').prop('checked',false);
      $l.children('.most-wrong-button').removeClass('active');
    }
  } else {
    $(this).siblings('input').prop('checked',false);
    $r.removeClass('least-wrong');
  }
  showButton();
});

$('.most-wrong-button').click(function() {
  $(this).toggleClass('active');
  if ( $(this).hasClass('active') ) {
    $r = $(this).parent().parent().parent();
    $l = $(this).parent().parent().siblings('.votebutton').children('label');
    $(this).siblings('input').prop('checked',true);
    $r.addClass('most-wrong');
    // remove the most wrong property on this row's siblings.
    $r.siblings('tr').removeClass('most-wrong');
    $r.siblings('tr').find('input[value="MostWrong"]').prop('checked', false);
    $r.siblings('tr').find('.most-wrong-button').removeClass('active');
    if ( $r.hasClass('least-wrong') ) {
      $r.removeClass('least-wrong');
      $l.children('input').prop('checked',false);
      $l.children('.least-wrong-button').removeClass('active');
    }
  } else {
    $(this).siblings('input').prop('checked',false);
    $r.removeClass('most-wrong');
  }
  showButton();
});

$('#SubmitVotes').click(function() {
  $('#VotingBooth').addClass('revealed');
  $('#SubmitVotes').addClass('hidden');
  $('#WaitingAtBoothBecause').text('waiting for other players to vote').removeClass('hidden');
  socket.emit(
    'playervotes',
    $('input[value="MostWrong"]:checked').attr('name'),
    $('input[value="LeastWrong"]:checked').attr('name')
  );
});

/////////////////////////////////////////////////
// GAME OVER ACTIONS
////////////////////////////////////////////////

$('a.social').click(function() {
  var n = $(this).attr('data-network');
  var h = $(this).attr('href');
  ga('send', 'event', { eventCategory: 'social share', eventAction: n, eventLabel: h });
});

$('#PlayAgain').click(function(){
  $('#GameOverScreen').addClass('hidden');
  $('#RoomSetup').removeClass('hidden');
  $('#roomDiv').removeClass('hidden');
});