// jshint -W117

function getStatements() {
  $('#RoomSetup').addClass('hidden');
  $('#GameView').removeClass('hidden');
  $('#orderDiv').show();
}

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