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
  $('#startDiv').removeClass('hidden');
  $('#createDiv').addClass('hidden');
}

// show me the join screen
function showJoin(){
  $('#startDiv').addClass('hidden');
  $('#joinDiv').removeClass('hidden');
}

function getStatements() {
  $('#RoomSetup').addClass('hidden');
  $('#GameView').removeClass('hidden');
  $('#orderDiv').removeClass('hidden');
}

function makeToast(holder, type, msg) {
  $('ul.toasts[data-toast="'+holder+'"]').append('<li class="'+type+'">'+msg+'</li>');
  setTimeout(function(){ 
    $('ul.toasts[data-toast="'+holder+'"] li:first-child').remove();
  }, 5200);
}

function showButton() {
  if ( $('.least-wrong').length > 0 && $('.most-wrong').length > 0 ) {
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

function makeDefend(){
  $('#dealerControls').addClass('hidden');
  socket.emit('makedefend');
}

//Tell server you are done defending your statement
function donedefend(){
  $('.knob-holder').addClass('hidden');
  $('#defendDiv').addClass('hidden');
  socket.emit('donedefending');
  meDefending = false;
}

function updateVoteSelectors(){
  var row = 0, theName;
  for(var i = 0; i < playerList.length; i++){
    theName = playerList[i];
    if (theName == username){
      $('#MyQuote').empty().append(currentStatements[username].quote.replace('{','').replace('}',''));
      $('#MyCite').empty().append(theName);
      continue;
    }
    row++;
    var theStatement = currentStatements[theName].quote.replace('{','').replace('}','');
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

function makeStatementTeaser(statement){
  var splat = statement.split('{');
  var toReturn = splat[0] + '...';
  return toReturn + statement.split('}')[1];
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
        console.log('time up: '+timer.total);
        if (gaTracking === true) {
          ga('send', 'event', { eventCategory: 'defended', eventAction: 'time up', eventLabel: timer.total });
        }
        donedefend();
      }
    return;
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

function startTimer(time) {
  timer.total = time;
  $(".knob").knob({
    'min': 0,
    'max': timer.total,
    'readOnly': true,
    'fgColor': '#7a6969',
    'bgColor': '#eae6e6',
    'dynamicDraw': true,
    'thickness': 0.5
  });
  $('.knob').val(timer.total).trigger('change');
  $('.knob').trigger('configure', {
    'fgColor': '#7a6969',
    'inputColor':"#2d2929"
  });
  $('.current-round').addClass('hidden');
  $('.knob-holder').removeClass('hidden');
  timer.current = timer.total;
  clockTick = setInterval(function(){ 
    everySecond();
  }, 1000);
}
