-- KEYS[1] is room data key, KEYS[2] is player list key, ARGV[1] is room name, ARGV[2] is random seed
math.randomseed(tonumber(ARGV[2]))

local roomData = redis.call('hmget',KEYS[1],'round','masterDeck','allowRedraw','deckLength','roundLimit')

if tonumber(roomData[1]) > tonumber(roomData[5]) then
  return nil
end

local playerData = redis.call('lrange',KEYS[2],0,-1)

local cardData = {}

for i = 1,roomData[4],1 do
  cardData[i] = redis.call('hmget','card:' .. ARGV[1] .. ':' .. i,'inPlay','discarded','score')
end

local toReturn = {{},{},{}}

for key,value in pairs(playerData) do
  local possible = {}
  --create lookup table for previous cards
  --TODO don't do this if not necessary
  local tmpPrevious = redis.call('smembers','player:previous:' .. ARGV[1] .. ':' .. value)
  local previous = {}
  for i,v in ipairs(tmpPrevious) do
    previous[v] = i
  end

  for i = 1,roomData[4],1 do
    -- not discarded or inPlay
    if (cardData[i][2] == '0') and (cardData[i][1] == '0') then
      --allowRedraw is off or hasn't been drawn before
      if(roomData[3] == '0') or (previous[i] == nil) then
	table.insert(possible,i)
      end
    end
  end
  local selected = possible[math.random(1,table.getn(possible))]
  cardData[selected][1] = 1
  redis.call('hmset','card:' .. ARGV[1] .. ':' .. selected,'inPlay',1,'mostVotes',0,'leastVotes',0)
  redis.call('sadd','player:previous:' .. ARGV[1] .. ':' .. value,selected)
  redis.call('hset','player:data:' .. ARGV[1] .. ':' .. value,'card',selected)
  table.insert(toReturn[1],value)
  table.insert(toReturn[2],selected)
  table.insert(toReturn[3],cardData[selected][3])
end

table.insert(toReturn,roomData[2])
table.insert(toReturn,roomData[1])
table.insert(toReturn,roomData[5])
return toReturn
