-- KEYS[1] is room data key, KEYS[2] is player list key
-- ARGV[1] is room name, ARGV[2] is random seed

math.randomseed(tonumber(ARGV[2]))

-- magic number, 0 = game not started
redis.call('hset',KEYS[1],'gameState',0)

local deckLength = redis.call('hget',KEYS[1],'deckLength')
local bestCardScore = 999
local candidates = {}
local tempCardScore
local cardKey
local finalCardScores = {}

for i = 1,deckLength,1 do
  cardKey = 'card:' .. ARGV[1] .. ':' .. i
  tempCardScore = tonumber(redis.call('hget', cardKey,'score'))
  table.insert(finalCardScores,tempCardScore)
  if tempCardScore == bestCardScore then
    table.insert(candidates,i)
  elseif tempCardScore < bestCardScore then
    candidates = {}
    bestCardScore = tempCardScore
    table.insert(candidates,i)
  end
  redis.call('del',cardKey)
end

local selected = candidates[math.random(1,table.getn(candidates))]
local deckName = redis.call('hget',KEYS[1],'masterDeck')
local playerList = redis.call('lrange',KEYS[2],0,-1);
local finalScores = {}
local whoHad = {}
for i, name in ipairs(playerList) do
  local previousKey = 'player:previous:' .. ARGV[1] .. ':' .. name
  if redis.call('sismember',previousKey,selected) == 1 then
    table.insert(whoHad,name)
  end
  table.insert(finalScores,redis.call('hget','player:data:' .. ARGV[1] .. ':' .. name,'score'))
end

redis.call('hincrby','decks:gamesFinishedToday',deckName,1)
redis.call('hincrby','decks:gamesFinishedLifetime',deckName,1);

local toReturn = {selected, bestCardScore, deckName, whoHad, playerList,finalScores,finalCardScores}

return toReturn
