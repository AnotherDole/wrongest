// jshint -W117
/////////////////////////////////////////////////
// SETUP ACTIONS
////////////////////////////////////////////////

$('#CreateRoomButton').click(function() {
  $('.create-or-join').addClass('hidden');
  $('.create-screen').removeClass('hidden');
});
$('#JoinRoomButton').click(function() {
  $('.lead-in').hide();
  $('.create-or-join').addClass('hidden');
  $('.join-screen').removeClass('hidden');
});

  // We wanna trigger the join or create buttons upon hitting Enter 
$('#createUsernameInput').keyup(function(e) {
  if(e.keyCode == 13){
    $("#CreateRoomButton").click();
  }
});
$('#joinUsernameInput').keyup(function(e) {
  if(e.keyCode == 13){
    $("#JoinRoomButton").click();
  }
});


$('#createPasswordInput').keyup(function() {
  console.log($(this).val());
  if ( $(this).val() === "") {
    $(this).parent().next().children().removeClass('fa-lock').addClass('fa-unlock');
  } else {
    $(this).parent().next().children().removeClass('fa-unlock').addClass('fa-lock');
  }
});

$('#roomURL').click(function() {
  this.selectionStart=0;
  this.selectionEnd=this.value.length;
  return false;
});

$('.settings-toggle').click(function() {
  $(this).toggleClass('expanded');
  $(this).children('.icon').toggleClass('spin');
  $('#leaderControls').toggleClass('hidden visible');
});


/////////////////////////////////////////////////
// GAMEPLAY ACTIONS
////////////////////////////////////////////////

$('#DoneEarlyButton').click(function() {
  window.clearInterval(clockTick);
  console.log('done early: '+timer.total);
  ga('send', 'event', { eventCategory: 'player action', eventAction: 'defended', eventLabel: 'done early', eventValue: timer.total });
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

if(location.pathname.length > 1){
  $('#startDiv').hide();
  $('#joinDiv').show();
  $('#joinRoomName').val(location.pathname.substr(1));
  socket.emit('requestroomdata',location.pathname.substr(1));
}
