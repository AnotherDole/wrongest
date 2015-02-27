-- KEYS[1] is roomDataKey, KEYS[2] is player list key, KEYS[3] is voter key, KEYS[4] is mostWrong key
-- KEYS[5] is leastWrong key, KEYS[6] is room waiting list
-- ARGV[1] is voter name, ARGV[2] is most name, ARGV[3] is least name, ARGV[4] is room name, ARGV[5] is random seed

local gameState = redis.call('hget',KEYS[1],'gameState')
--magic number, 3 is waiting votes
if(gameState ~= '3') then
  return false
end

local playerList = redis.call('lrange',KEYS[2],0,-1)
local invertedList = {}
for i, v in ipairs(playerList) do
  invertedList[v] = i
end

if invertedList[ARGV[1]] == nil or invertedList[ARGV[2]] == nil or invertedList[ARGV[3]] == nil then
  return nil
end

local voted = redis.call('hget',KEYS[3],'voted')
if(voted == '1') then
  return nil
end

-- vote is go
local mostCardNum = redis.call('hget',KEYS[4],'card')
local leastCardNum = redis.call('hget',KEYS[5],'card')

redis.call('hincrby','card:' .. ARGV[4] .. ':' .. mostCardNum,'mostVotes',1)
redis.call('hincrby','card:' .. ARGV[4] .. ':' .. leastCardNum,'leastVotes',1)
redis.call('hset',KEYS[3],'voted',1)
local votes = redis.call('hincrby',KEYS[1],'votesReceived',1)
local votesNeeded = table.getn(playerList) - votes

if votesNeeded > 0 then
  return {votesNeeded}
end

math.randomseed(tonumber(ARGV[5]))

local toReturn = {votesNeeded}

-- if votesNeeded = 0, it's time to end the round
local resultNames = {}
local resultNewScores = {}
local resultScoreChanges = {}
local resultNewUIDs = {}
local cardsLeft = redis.call('hget',KEYS[1],'cardsLeft')

for i, name in ipairs(playerList) do
  table.insert(resultNames,name)
  local playerDataString = ('player:data:' .. ARGV[4] .. ':' .. name)
  local playerCard = redis.call('hget',playerDataString,'card')
  local cardDataString = ('card:' .. ARGV[4] .. ':' .. playerCard)
  local cardData = redis.call('hmget',cardDataString,'score','mostVotes','leastVotes')

  local toAdd = tonumber(cardData[3])
  if(tonumber(cardData[1]) < -1) then
    toAdd = toAdd * 2
  end

  table.insert(resultScoreChanges,toAdd)
  table.insert(resultNewScores,redis.call('hincrby',playerDataString,'score',toAdd))

  redis.call('hset',playerDataString,'voted',0)
  local newCardScore = tonumber(redis.call('hincrby',cardDataString,'score',tonumber(cardData[3])-tonumber(cardData[2])))
  if newCardScore >= 0 then
    redis.call('hset',cardDataString,'discarded',1)
    cardsLeft = redis.call('hincrby',KEYS[1],'cardsLeft',-1)
  elseif newCardScore == -1 then
    if math.random(1,2) == 1 then
      redis.call('hset',cardDataString,'discarded',1)
      cardsLeft = redis.call('hincrby',KEYS[1],'cardsLeft',-1)
    else
      redis.call('hset',cardDataString,'inPlay',0)
    end
  else
    redis.call('hset',cardDataString,'inPlay',0)
  end
end

--magic number 1 = GAME_BETWEEN_ARGUMENTS
redis.call('hmset',KEYS[1],'gameState',1,'votesReceived',0)
local round = redis.call('hincrby',KEYS[1],'round',1)

local waitingList = redis.call('lrange',KEYS[6],0,-1)
for i, name in pairs(waitingList) do
  table.insert(resultNames,name)
  table.insert(resultScoreChanges,0)
  local playerDataString = ('player:data:' .. AGRV[4] .. ':' .. name)
  local playerData = redis.call('hmget',playerDataString,'score','uid')
  table.insert(resultNewScores,playerData[1])
  table.insert(resultNewUIDs,playerData[2])
  redis.call('rpush',KEYS[2],name)
end

redis.call('del',KEYS[6])

table.insert(toReturn,round)
table.insert(toReturn,cardsLeft)
table.insert(toReturn,resultNames)
table.insert(toReturn,resultNewScores)
table.insert(toReturn,resultScoreChanges)
table.insert(toReturn,resultNewUIDs)

return toReturn
