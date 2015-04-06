--nuke all of the non-permanent data
local toDelete = redis.call('keys','player:*')
for i = 1,table.getn(toDelete),1 do
  redis.call('del',toDelete[i])
end

toDelete = redis.call('keys','room:*')
for i = 1,table.getn(toDelete),1 do
  redis.call('del',toDelete[i])
end

toDelete = redis.call('keys','card:*')
for i = 1,table.getn(toDelete),1 do
  redis.call('del',toDelete[i])
end

redis.call('del','activeRooms')
