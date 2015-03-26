-- KEYS[1] is player list key, KEYS[2] is player waiting key, KEYS[3] is player data key, KEYS[4] is room data key
-- KEYS[5] is all players key
-- ARGV[1] is the player name, ARGV[2] is room name
-- toReturn: 1 = fromWaiting, 2 = roomDeleted, 3 = duringGame, 
-- 4 = duringArg, 5 = defenderLeft, 6 = duringVote 7 = new needed

local toReturn = {false,false,false,false,false,false, 0}
local playerList = redis.call('lrange',KEYS[1],0,-1)
local playerIndex = -1
for i = 1, table.getn(playerList), 1 do
  if playerList[i] == ARGV[1] then
    playerIndex = i
  end
end

--player didn't exists or was in waiting list
if playerIndex == -1 then
  toReturn[1] = true
  redis.call('lrem',KEYS[2],0,ARGV[1])
  redis.call('del',KEYS[3])
  return toReturn
end

redis.call('lrem',KEYS[1],0,ARGV[1])
local numPlayers = tonumber(redis.call('llen',KEYS[1]))
-- no players left, delete all room data
if numPlayers == 0 then
  redis.call('del',KEYS[3])
  redis.call('del',KEYS[2])
  redis.call('del',KEYS[1])

  local deckLength = redis.call('hget',KEYS[4],'deckLength')
  if deckLength ~= false then
    for i = 1,deckLength,1 do
      redis.call('del', 'card:' .. ARGV[2] .. ':' .. i)
    end
  end

  redis.call('del',KEYS[4])
  local allPlayers = redis.call('smembers',KEYS[5])
  for i = 1, table.getn(allPlayers), 1 do
    redis.call('del','player:previous:' .. ARGV[2] .. ':' .. allPlayers[i])
    redis.call('del','room:leaveScore:' .. ARGV[2] .. ':' .. allPlayers[i])
  end
  redis.call('del',KEYS[5])
  toReturn[2] = true
  return toReturn
end

local roomData = redis.call('hmget', KEYS[4],'dealer','gameState','votesReceived','whosUp')

--mark their card as no longer in play
if roomData[2] ~= '0' then
  local whichCard = redis.call('hget',KEYS[3],'card')
  if whichCard ~= '-1' then
    redis.call('hset','card:' .. ARGV[2] .. ':' .. whichCard,'inPlay',0)
  end
end

-- still players left, find new dealer
if roomData[1] == ARGV[1] then
  local newDealer = playerList[1]
  if newDealer == ARGV[1] then
    newDealer = playerList[2]
  end
  redis.call('hset',KEYS[4],'dealer',newDealer)
end

--magic numbers 1 = between arguments, 2 = someone arguing
if roomData[2] == '1' or roomData[2] == '2' then
  toReturn[3] = true
  toReturn[4] = true
  local voted = redis.call('hget',KEYS[3],'voted')
  if voted == '1' then
    roomData[3] = redis.call('hincrby',KEYS[3],'votesReceived',-1)
    local newUp = playerIndex - 1
    if newUp == 0 then newUp = numPlayers - 1 end
    redis.call('hset',KEYS[3],'whosUp',newUp)
  elseif roomData[2] == '2' and roomData[4] == playerIndex then
    -- if they were the one defending
    redis.call('hset',KEYS[3],'gameState',1)
    toReturn[5] = true
  end
  -- set new votes needed count
  toReturn[7] = numPlayers - roomData[3]
end

--if during a vote
if roomData[2] == '3' then
  toReturn[3] = true
  toReturn[6] = true
  local cardNum;
  --need to clear all previous votes
  for i = 1, table.getn(playerList), 1 do
    cardNum =redis.call('hget',('player:data:' .. ARGV[2] .. ':' .. playerList[i]),'card')
    redis.call('hmset',('card:' .. ARGV[2] .. ':' .. cardNum),'mostVotes',0,'leastVotes',0)
  end
end

-- record their score so they get it back if they return
local theirScore = redis.call('hget',KEYS[3],'score')
redis.call('set','room:leaveScore:' .. ARGV[2] .. ':' .. ARGV[1],theirScore)

-- if there are only 2 active players, pause the game
-- -1 = game paused
if numPlayers == 2 then
  redis.call('hset', KEYS[4],'gameState',-1)
  local waitingPlayers = redis.call('lrange', KEYS[2],0,-1)
  for k, name in ipairs(waitingPlayers) do
    redis.call('rpush',KEYS[1],name)
  end
  redis.call('del',KEYS[2])
end

redis.call('del',KEYS[3])

return toReturn
