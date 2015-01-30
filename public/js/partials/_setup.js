/* jshint -W117 */
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
  if ( $(this).val() == "") {
    $(this).parent().next().children().removeClass('fa-lock').addClass('fa-unlock');
  } else {
    $(this).parent().next().children().removeClass('fa-unlock').addClass('fa-lock');
  }
});

$('#roomURL').focus(function() {
  $(this).select();
});

