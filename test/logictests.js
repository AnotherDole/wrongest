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
    it('and this one',function(done){
      logic.joinRequest('Player3','hi',testRoom,function(err,result){
	result.success.should.equal(true);
	done();
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
	done();
      })
    })
  })
})
