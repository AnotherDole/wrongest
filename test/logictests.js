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
	result.roomName.length.should.be.above(5);
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
      logic.joinRequest('  ','hi',testRoom,function(err,result){
	result.success.should.equal(false);
	done();
      })
    });
    it('should not allow joining a room that is not there',function(done){
      logic.joinRequest('Player2','hi','blahbhahlsd',function(err,result){
	result.success.should.equal(false);
	done();
      })
    })
    it('should accept this one',function(done){
      logic.joinRequest('Player2','hi',testRoom,function(err,result){
	result.success.should.equal(true);
	done();
      })
    })
    it('should not accept duplicate names',function(done){
      logic.joinRequest('Player1','hi',testRoom,function(err,result){
	result.success.should.equal(false);
	done();
      })
    })
    it('and these',function(done){
      logic.joinRequest('Player3','hi',testRoom,function(err,result){
	result.success.should.equal(true);
	logic.joinRequest('Player4','hi',testRoom,function(err,result){
	  result.success.should.equal(true);
	  done();
	})
      })
    })
  })
  describe('getPlayersIn',function(){
    it('should show 3 player in this room',function(done){
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
      logic.startRequest('Player1',testRoom,{deckName:'General Nonsense'},function(err,result){
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
  })
})
