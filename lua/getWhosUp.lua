-- KEYS[1] is room data key, KEYS[2] is room players key, ARGV[1] is player name of requester

local roomData = redis.call('hmget',KEYS[1],'dealer','gameState','whosUp','timeLimit')
-- magic number alert: 1 is GAME_BETWEEN_ARGUMENTS
if (ARGV[1] ~= roomData[1]) or (roomData[2] ~= '1') then
  return false
end

local up = redis.call('lindex',KEYS[2],tonumber(roomData[3])-1)
-- magic number alert: 2 is GAME_SOMEONE_ARGUING
redis.call('hset',KEYS[1],'gameState','2')

return {up,roomData[4]}
