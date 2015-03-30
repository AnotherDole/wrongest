var should = require('should');
var logic = require('../logic.js');

var redis = require('redis');
var client = redis.createClient();
client.flushall();

logic.setClient(client);

var testRoom;

describe('Room Creation',function(){
  describe('Usernames',function(){
    it('should reject empty user names',function(done){
      logic.createRoom(' ','hi',function(err,result){
	result.success.should.equal(false);
	done();
      })
    })
    it('should reject invalid user names',function(done){
      logic.createRoom('8@#','hi',function(err,result){
	result.success.should.equal(false);
	done();
      })
    })
    it('should accept this user name',function(done){
      logic.createRoom('Player1','hi',function(err,result){
	result.success.should.equal(true);
	result.roomName.length.should.be.above(3);
	testRoom = result.roomName;
	done();
      })
    })
  })
  describe('getPlayersIn',function(){
    it('should show 1 player in this room',function(done){
      logic.getPlayersIn(testRoom,function(err,result){
	result.success.should.equal(true);
	result.leader.should.equal('Player1');
	result.dealer.should.equal('Player1');
	result.players[0].should.equal('Player1');
	done();
      })
    })
  })
})

describe('Joining Rooms',function(){
  describe('Usernames',function(){
    it('should reject this name',function(done){
      logic.joinRequest(testRoom,'  ','hi',function(err,result){
	result.success.should.equal(false);
	done();
      })
    });
    it('should not allow joining a room that is not there',function(done){
      logic.joinRequest('lklsjldjlsjdlsjkdff','Player2','hi',function(err,result){
	result.success.should.equal(false);
	done();
      })
    })
    it('should accept this one',function(done){
      logic.joinRequest(testRoom,'Player2','hi',function(err,result){
	result.success.should.equal(true);
	done();
      })
    })
    it('should not accept duplicate names',function(done){
      logic.joinRequest(testRoom,'Player1','hi',function(err,result){
	result.success.should.equal(false);
	done();
      })
    })
    it('and these',function(done){
      logic.joinRequest(testRoom,'Player3','hi',function(err,result){
	result.success.should.equal(true);
	logic.joinRequest(testRoom,'Player4','hi',function(err,result){
	  result.success.should.equal(true);
	  done();
	})
      })
    })
  })
  describe('getPlayersIn',function(){
    it('should show 4 player in this room',function(done){
      logic.getPlayersIn(testRoom,function(err,result){
	result.success.should.equal(true);
	result.leader.should.equal('Player1');
	result.dealer.should.equal('Player1');
	result.players[0].should.equal('Player1');
	result.players[1].should.equal('Player2');
	result.players[2].should.equal('Player3');
	result.players[3].should.equal('Player4');
	done();
      })
    })
  })
})

describe('Starting Games',function(){
  describe('Bad Start Requests',function(){
    it('should not accept a start from someone other than the leader',function(done){
      logic.startRequest('Player2',testRoom,{},function(err,result){
	result.success.should.equal(false);
	done();
      })
    })
    it('should not start with a bad deck name',function(done){
      logic.startRequest('Player1',testRoom,{deckName:'this deck will never exist'},function(err,result){
	result.success.should.equal(false);
	done();
      })
    })
  })
  describe('Good Start Request',function(){
    it('should accept this start request',function(done){
      logic.startRequest('Player1',testRoom,{deckName:'Science Facts'},function(err,result){
	result.success.should.equal(true);

	logic.getStatements(testRoom,function(err,result){
	  result.should.have.property('Player1');
	  result.Player1.should.have.property('quote');
	  result.Player1.quote.length.should.be.above(1);

	  logic.adjustOrder(testRoom,function(err,result){
	    result.should.have.property('players');
	    //default is dealer last
	    result.players[0].should.equal('Player2');
	    result.players[1].should.equal('Player3');
	    result.players[2].should.equal('Player4');
	    result.players[3].should.equal('Player1');
	    done();
	  })
	})
      })
    })
  })
})

describe('Playing the Game',function(){
  describe('getWhosUp',function(){
    it('should not accept requests from non-dealers',function(done){
      logic.getWhosUp(testRoom,'Player2',function(err,result){
	result.should.equal(false);
	done();
      })
    })
    it('should accept requests from the dealer...',function(done){
      logic.getWhosUp(testRoom,'Player1',function(err,result){
	result.should.not.equal(false);
	result.should.have.property('player');
	result.player.length.should.be.above(0);
	result.time.should.be.above(0);
	done();
      })
    })
    it('...but not when someone is alreay defending',function(done){
      logic.getWhosUp(testRoom,'Player1',function(err,result){
	result.should.equal(false);
	done();
      })
    })
  })
  describe('doneDefending',function(){
    it('should not accept a doneDefending from the wrong player',function(done){
      logic.doneDefending(testRoom,'Player1',function(err,result){
	result.should.equal(false);
	done();
      })
    })
    it('should accept a doneDefending from the right player',function(done){
      logic.doneDefending(testRoom,'Player2',function(err,result){
	result.should.have.property('votesNeeded');
	result.votesNeeded.should.equal(3);
	done();
      })
    })
    it('should handle the next player properly',function(done){
      logic.getWhosUp(testRoom,'Player1',function(err,result){
	result.should.have.property('player');
	logic.doneDefending(testRoom,'Player3',function(err,result){
	  result.votesNeeded.should.equal(2);
	  done();
	})
      })
    })
    it('and the next one',function(done){
      logic.getWhosUp(testRoom,'Player1',function(err,result){
	result.should.have.property('player');
	logic.doneDefending(testRoom,'Player4',function(err,result){
	  result.votesNeeded.should.equal(1);
	  done();
	})
      })
    })
    it('and the last one',function(done){
      logic.getWhosUp(testRoom,'Player1',function(err,result){
	result.should.have.property('player');
	logic.doneDefending(testRoom,'Player1',function(err,result){
	  result.votesNeeded.should.equal(0);
	  logic.prepareForVotes(testRoom,function(err,data){
	    done();
	  })
	})
      })
    })
  })
})

describe('Voting',function(){
  describe('Bad Votes',function(){
    it('should reject vote from non-existant player',function(done){
      logic.processVote(testRoom,'Player0','Player1','Player2',function(err,result){
	result.should.equal(false);
	done();
      })
    })
    it('should reject vote for a non-existant player', function(done){
      logic.processVote(testRoom,'Player1','Player2','Player0',function(err,result){
	result.should.equal(false);
	done();
      })
    })
    it('should reject vote for same players',function(done){
      logic.processVote(testRoom,'Player1','Player2','Player2',function(err,result){
	result.should.equal(false);
	done();
      })
    })
    it('should reject vote for self',function(done){
      logic.processVote(testRoom,'Player1','Player1','Player2',function(err,result){
	result.should.equal(false);
	done();
      })
    })
  })
  describe('Good Votes',function(){
    it('should accept this vote',function(done){
      logic.processVote(testRoom,'Player1','Player2','Player3',function(err,result){
	result.should.not.equal(false);
	result.should.have.property('votesNeeded');
	result.votesNeeded.should.equal(3);
	done();
      })
    })
    it('but not a re-vote',function(done){
      logic.processVote(testRoom,'Player1','Player2','Player3',function(err,result){
	result.should.equal(false);
	done();
      })
    })
    it('should accept these votes',function(done){
      logic.processVote(testRoom,'Player2','Player3','Player1',function(err,result){
	result.should.not.equal(false);
	result.should.have.property('votesNeeded');
	result.votesNeeded.should.equal(2);
	logic.processVote(testRoom,'Player3','Player1','Player2',function(err,result){
	  result.should.not.equal(false);
	  result.should.have.property('votesNeeded');
	  result.votesNeeded.should.equal(1);
	  done();
	})
      })
    })
    it('should end the round with this vote',function(done){
      logic.processVote(testRoom,'Player4','Player1','Player2',function(err, result){
	result.should.not.equal(false)
	result.votesNeeded.should.equal(0);
	//round 2
	result.gameData.round.should.equal(1);
	logic.adjustOrder(testRoom,function(err,result){
	  result.dealer.should.equal('Player4');
	  done();
	})
      })
    })
  })
})

describe('Leaving',function(){
  describe('Between arguments',function(){
    it('should accept this leave',function(done){
      logic.leaveRequest(testRoom,'Player2',function(err,result){
	logic.getPlayersIn(testRoom,function(err,result){
	  result.players.length.should.equal(3);
	  result.dealer.should.equal('Player4');
	  done();
	})
      })
    })
    it('should accept this one too',function(done){
      logic.leaveRequest(testRoom,'Player1',function(err,result){
	logic.getPlayersIn(testRoom,function(err,result){
	  result.players.length.should.equal(2);
	  result.dealer.should.equal('Player4');
	  done();
	})
      })
    })
    it('should have paused the game',function(done){
      logic.getWhosUp(testRoom,'Player3',function(err,result){
	result.should.equal(false);
	done();
      })
    })
  })
  describe('Restart',function(){
    it('should not allow a restart with only 2 players',function(done){
      logic.tryRestartGame(testRoom,'Player3',function(err,result){
	result.should.equal(false);
	done();
      })
    })
    it('should only allow a restart from the dealer',function(done){
      logic.joinRequest(testRoom,'Player5','hi',function(err,result){
	result.success.should.equal(true);
	logic.tryRestartGame(testRoom,'Player3',function(err,result){
	  result.should.equal(false);
	  done();
	})
      })
    })
    it('should allow this restart',function(done){
      logic.tryRestartGame(testRoom,'Player4',function(err,result){
	result.should.equal(true);
	done();
      })
    })
    it('so it should allow a getWhosUp',function(done){
      logic.getWhosUp(testRoom,'Player4',function(err,result){
	result.player.should.equal('Player3')
	done();
      })
    })
  })
})
