// jshint -W117

// GENERAL UTILITY "SHUFFLE STUFF" FUNCTION. Use: $('element').shuffle();
(function($){

  $.fn.shuffle = function() {
    return this.each(function(){
      var items = $(this).children().clone(true);
      return (items.length) ? $(this).html($.shuffle(items)) : this;
    });
  };

  $.shuffle = function(arr) {
    for(var j, x, i = arr.length; i; j = parseInt(Math.random() * i), x = arr[--i], arr[i] = arr[j], arr[j] = x);
    return arr;
  };

})(jQuery);


// Show me the create screen
function showCreate(){
  $('#startDiv').hide();
  $('#createDiv').show();
}

// show me the join screen
function showJoin(){
  $('#startDiv').hide();
  $('#joinDiv').show();
}

function getStatements() {
  $('#RoomSetup').addClass('hidden');
  $('#GameView').removeClass('hidden');
  $('#orderDiv').show();
}

function clearToast() {
  setTimeout(function(){ $('#SetupToasts li:first-child').remove(); }, 5200);
}

function showButton() {
  if ( $('input[value="LeastWrong"]:checked').length > 0 && $('input[value="MostWrong"]:checked').length > 0 ) {
    $('.button-holder').removeClass('hidden');
  } else {
    $('.button-holder').addClass('hidden');
  }
}

function updateDeckDescription(){
  var theDeck = deckData[$('#deck').val()];
  $('#deckdescription').empty().append(theDeck.description + ' Cards: ' + theDeck.numCards);
}

//send username, room name, password 
function createroom(){
  socket.emit('createroom',$('#createUsernameInput').val());
}

//send username, room name, password 
function joinroom(){
  socket.emit('requestjoin',
    $('#joinUsernameInput').val(),
    $('#joinRoomName').val()
  );
}

//send request to leave current room. 
function leaveroom(){
  socket.emit('requestleave');
}

//Request to start the game. Only works if you are the leader of the room
function startgame(){
  socket.emit('requeststart',
    $('#deck').val(),
    $('#timeLimit').val(),
    $('#allowRedraw').val(),
    $('#dealerSelect').val()
  );
}

function makeDefend(){
  $('#dealerControls').hide();
  socket.emit('makedefend');
}

//Tell server you are done defending your statement
function donedefend(){
  $('.knob-holder').addClass('hidden');
  $('#defendDiv').hide();
  socket.emit('donedefending');
  meDefending = false;
}

function updateVoteSelectors(){
  var row = 0, theName;
  for(var i = 0; i < playerList.length; i++){
    theName = playerList[i];
    if (theName == username){
      $('#MyQuote').empty().append(currentStatements[username].quote);
      $('#MyCite').empty().append(theName);
      continue;
    }
    row++;
    var theStatement = currentStatements[theName].quote;
    $('#voterow' + row).removeClass('hidden');
    $('#votequote' + row).empty().text(theStatement);
    $('#quotecite' + row).empty().text(theName);
    $('#mostwrong' + row).attr('name',theName);
    $('#leastwrong' + row).attr('name',theName);
  }
  //hide rows with no data
  for(row++; row <= 7; row++){
    $('#voterow' + row).addClass('hidden');
  }
}



///////////////////////////////////////////
// TIMER STUFF 
///////////////////////////////////////////
var timer = { };
timer.total = 30;
timer.notice = 20;
timer.warning = 10;
timer.danger = 5;
timer.current = timer.total;
timer.knobColor = '#38A4DC';
timer.knobTextColor = '#2d2929';
var clockTick;

function everySecond() {
  timer.current--;
  if (timer.current <= 0) {
    window.clearInterval(clockTick);
      if(meDefending){
        donedefend();
      }
    return;
  }
  if (timer.current > timer.notice) {
    timer.knobColor = '#38A4DC';
    timer.knobTextColor = '#2d2929';
  } else if (timer.current > timer.warning) {
    timer.knobColor = '#7a6969';
    timer.knobTextColor = '#2d2929';
  } else if (timer.current > timer.danger) {
    timer.knobColor = '#EF4D79';
    timer.knobTextColor = '#2d2929';
  } else {
    timer.knobColor = '#c1272d';
      timer.knobTextColor = '#c1272d';
  }
  $('.knob').trigger('configure', {
    'fgColor': timer.knobColor, 
    'inputColor': timer.knobTextColor
  });
  $('.knob').val(timer.current).trigger('change');
}

function startTimer() {
  $('input.knob').val(timer.total).trigger('change');
  $(".knob").knob({
    'min': 0,
    'max': timer.total,
    'readOnly': true,
    'fgColor': '#38A4DC',
    'bgColor': '#eae6e6',
    'dynamicDraw': true,
    'thickness': 0.5,
    'inputColor':"#2d2929"
  });
  $('.knob-holder').removeClass('hidden');
  timer.current = timer.total;
  clockTick = setInterval(function(){ 
    everySecond();
  }, 1000);
}
