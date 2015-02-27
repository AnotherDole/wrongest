-- KEYS[1] is room data key, KEYS[2] is player list key, ARGV[1] is room name

--magic number alert: 3 = GAME_WAITING_VOTES
redis.call('hmset',KEYS[1],'gameState',3,'votesReceived',0)
local playerList = redis.call('lrange',KEYS[2],0,-1)

for i,name in pairs(playerList) do
  redis.call('hmset','player:data:' .. ARGV[1] .. ':' .. name,'voted',0)
end
