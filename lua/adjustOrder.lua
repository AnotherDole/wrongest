-- KEYS[1] is room data key, KEYS[2] is room players key

local roomData = redis.call('hmget',KEYS[1],'leader','dealer','dealerFirst','round','whosUp');
local playerList = redis.call('lrange',KEYS[2],0,-1);

local numPlayers = table.getn(playerList)
local dealerIndex = -1
local leaderIndex = -1
for i = 1,8,1 do
  if(playerList[i] == roomData[1]) then
    leaderIndex = i
  end
  if(playerList[i] == roomData[2]) then
    dealerIndex = i
  end
end

--first round
if roomData[4] == '1' then
  --dealer first
  if roomData[3] == '1' then
    redis.call('hmset',KEYS[1],'whosUp',leaderIndex,'dealer',roomData[1])
  else
    redis.call('hmset',KEYS[1],'whosUp',(leaderIndex % numPlayers) + 1,'dealer',roomData[1])
  end
else
  local newIndex = (dealerIndex % numPlayers) + 1
  if roomData[3] == '1' then
    redis.call('hmset',KEYS[1],'whosUp',newIndex,'dealer',playerList[newIndex])
  else
    redis.call('hmset',KEYS[1],'whosUp',(newIndex % numPlayers) + 1,'dealer',playerList[newIndex])
  end
end
