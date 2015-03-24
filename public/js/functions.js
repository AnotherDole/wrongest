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