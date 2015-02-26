-- KEYS[1] is room data key, KEYS[2] is player data key, KEYS[3] is room players key
-- ARGV[1] is requester name

local roomData = redis.call('hmget',KEYS[1],'gameState','whosUp')
local voted = redis.call('hget',KEYS[2],'voted')
local playerList = redis.call('lrange',KEYS[3],0,-1)
local up = playerList[tonumber(roomData[2])]

-- magic number: 2 is someone arguing
if (roomData[1] ~= '2') or (voted == '1') or (up ~= ARGV[1]) then
  return false
end

local newNext = (tonumber(roomData[2]) % table.getn(playerList)) + 1
redis.call('hmset',KEYS[1],'gameState',1,'whosUp',newNext)
redis.call('hset',KEYS[2],'voted',1)
local votes = redis.call('hincrby',KEYS[1],'votesReceived',1)

return table.getn(playerList) - votes
