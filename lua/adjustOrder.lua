-- KEYS[1] is room data key, KEYS[2] is room players key

local roomData = redis.call('hmget',KEYS[1],'dealer','dealerFirst','round');
local playerList = redis.call('lrange',KEYS[2],0,-1);

local numPlayers = table.getn(playerList)
local dealerIndex = -1
for i = 1,numPlayers,1 do
  if playerList[i] == roomData[1] then
    dealerIndex = i
  end
end

local cycles = 1
--first round
if roomData[3] == '1' then
  --dealer first
  if roomData[2] == '1' then
    cycles = numPlayers - dealerIndex + 1
    if cycles == numPlayers then
      cycles = 0
    end
  else
    cycles = numPlayers - dealerIndex
  end
end
for i = 1,cycles,1 do
  table.insert(playerList,1,table.remove(playerList))
  redis.call('lpush',KEYS[2],redis.call('rpop',KEYS[2]))
end
local newIndex
if roomData[2] == '1' then
  newIndex = 1
else
  newIndex = numPlayers
end
redis.call('hmset',KEYS[1],'whosUp',1,'dealer',playerList[newIndex])
