-- KEYS[1] is room data key, KEYS[2] is room players key
-- ARGV[1] is player name, ARGV[2] is room name

local roomData = redis.call('hmget',KEYS[1],'gameState','dealer')
-- -1 is game paused
if roomData[1] ~= '-1' or roomData[2] ~= ARGV[1] then
  return false
end

local playerList = redis.call('lrange',KEYS[2],0,-1)
local numPlayers = table.getn(playerList)
if numPlayers < 3 then
  return false
end

-- restart is go
-- 1 is between arguments
redis.call('hmset',KEYS[1],'votesReceived',0,'gameState',1)
for i, name in pairs(playerList) do
  local theKey = 'player:data:' .. ARGV[2] .. ':' .. ARGV[1]
  local cardNum = redis.call('hget',theKey,'card')
  if cardNum ~= '-1' then
    local cardKey = 'card:' .. ARGV[2] .. ':' .. cardNum
    redis.call('hmset',cardKey,'inPlay',0,'mostVotes',0,'leastVotes',0)
  end
  redis.call('hmset',theKey,'card',-1,'voted',0)
end

return true
