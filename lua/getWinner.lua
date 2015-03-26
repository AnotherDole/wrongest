-- KEYS[1] is room data key
-- ARGV[1] is room name, ARGV[2] is random seed

math.randomseed(tonumber(ARGV[2]))

-- magic number, 0 = game not started
redis.call('hset',KEYS[1],'gameState',0)

local deckLength = redis.call('hget',KEYS[1],'deckLength')
local bestCardScore = 999
local candidates = {}
local tempCardScore
local cardKey

for i = 1,deckLength,1 do
  cardKey = 'card:' .. ARGV[1] .. ':' .. i
  tempCardScore = tonumber(redis.call('hget', cardKey,'score'))
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

local toReturn = {selected, bestCardScore, deckName}

return toReturn
