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

$('#createPasswordInput').keyup(function() {
  console.log($(this).val());
  if ( $(this).val() === "") {
    $(this).parent().next().children().removeClass('fa-lock').addClass('fa-unlock');
  } else {
    $(this).parent().next().children().removeClass('fa-unlock').addClass('fa-lock');
  }
});

$('#roomURL').click(function() {
  $(this).select();
  return false;
});

$('.settings-toggle').click(function() {
  $(this).toggleClass('expanded');
  $(this).children('.fa').toggleClass('spin');
  $('#leaderControls').toggleClass('hidden visible');
});


/////////////////////////////////////////////////
// GAMEPLAY ACTIONS
////////////////////////////////////////////////

$('.least-wrong-button').click(function() {
  $(this).toggleClass('active');
  if ( $(this).hasClass('active') ) {
    $r = $(this).parent().parent().parent();
    $l = $(this).parent().parent().siblings('.votebutton').children('label');
    $(this).siblings('input').prop('checked',true);
    $r.addClass('least-wrong');
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