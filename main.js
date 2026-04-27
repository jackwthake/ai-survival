import { generateWorld, describeEnvironment, describeDirection, TILES, tileSize, worldWidth, worldHeight, tickTemperature } from './world.js'

const canvas = document.getElementById('world')
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false;
const chatInput = document.getElementById('chat-input');
let userMessage = null;
canvas.width = 800
canvas.height = 800

const atlas = new Image()
atlas.src = 'tiles.png'

let simulationHistory = {
    worldSeed: null,
    system_prompt: null,
    initialState: {}, // Positions and stats at Tick 0
    ticks: []        // Every action, thought, and speech event
};

const system_personal = "You are a human that has just found yourself in a wild and unfamiliar world. \
You have no memory of before. You are aware of your body, your hunger, and your \
surroundings. You think, you speak english, and you act. You are curious. You want to understand."

const system_prompt ="xACTIONS: \
- MOVE_N/S/E/W/NE/NW/SE/SW: Move one tile in that direction \
- EAT: Eat from your inventory \
- DRINK: Drink when on or near water \
- GATHER_BERRIES: Gather berries from a bush on your current tile \
- GO_FISH: Fish when on or near water \
- CHOP_TREE: Chop tree down when on or near a tree, gain wood \
- GIVE BERRY or GIVE FISH or GIVE WOOD: Give an item to someone on your tile \
- START_FIRE: attempt to start a fire, requires 2 wood \
- BUILD_STRUCTURE: build a structure tile, provides shelter and warmth, costs 10 wood \
- ATTACK: Attack another person if they are within 1 tile of you \
- WAIT: Do nothing this tick \
\
To interact with another person or object you must be at most 1 tile away.\
If your thirst is below 40 and hunger below 20 you will gradually heal. \
Doing an activity has the posibility of improving the skill \
Fish are far more nutritious than berries \
Exposure to the cold is detrimental \
Structures provide warmth and shelter \
There could be others in the world, whetheer or not they are friendly is unknown. \
Every position can have only one type of object \
\
You respond every turn in exactly this format and NEVER any other: \
THINK: [your internal thoughts, honest, unfiltered, max 100 words] \
SPEAK: [only speak when genuinely compelled, don't narrate, use *sound* for non-word vocalizations, plain text for words, or dont put anything at all] \
ACT: [one action from the list above]"

// World grid holds tile types, temp grid holds local temperature vals, data grid holds data for individual tiles ie growth stage
var [ world_grid, temp_grid, data_grid ] = generateWorld(worldWidth, worldHeight)

const ACTIONS = {
  WAIT: "WAIT",
  MOVE_N: "Move North",
  MOVE_S: "Move South",
  MOVE_E: "Move East",
  MOVE_W: "Move West",
  MOVE_NE: "Move Northeast", 
  MOVE_NW: "Move Northwest", 
  MOVE_SE: "Move Southeast",
  MOVE_SW: "Move Southwest",
  EAT: "Eat",
  DRINK: "Drink",
  FISH: "Fish",
  GATHER: "Gather",
  GIVE: "Give Item",
  CHOP_TREE: "Chop Down Tree",
  START_FIRE: "Start Fire",
  BUILD_STRUCTTURE: "Build Structure",
  ATTACK: "Attack"
}

const agentA = {
  x: 30,
  y: 30,
  health: 10, hunger: 50, strength: 50, sight: 10,
  firestarting: 2, fishing: 3, friendliness: 3, 
  messages: [],
  lastSpeech: null,
  name: 'Thadeus',
  color: '#0ff',
  logId: 'thoughts-A',
  thirst: 15,
  lastAction: ACTIONS.WAIT,
  inventory: {
    berries: 0,
    fish: 0,
    wood: 4,
  },
  accomplished_last: "",
  shortTermMemory: [], // Stores last 5 ticks of detail
  longTermMemory: [],  // Stores summarized significance
  systemPersona: system_personal,
  tickCounter: 0
}

const agentB = {
  x: 28,
  y: 25,
  health: 87, hunger: 10, strength: 50, sight: 10,
  firestarting: 4, fishing: 5, friendliness: 1,
  messages: [],
  lastSpeech: null,
  name: 'Bertrand',
  color: '#ff0',
  logId: 'thoughts-B',
  thirst: 15,
  lastAction: ACTIONS.WAIT,
  inventory: {
    berries: 1,
    fish: 1,
    wood: 6
  },
  accomplished_last: "",
  shortTermMemory: [], // Stores last 5 ticks of detail
  longTermMemory: [],  // Stores summarized significance
  systemPersona: system_personal,
  tickCounter: 0
}

export function agentDistance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function downloadHistory() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(simulationHistory, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `sim_history_${Date.now()}.json`);
  document.body.appendChild(downloadAnchorNode); 
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function captureInitialState() {
  simulationHistory.system_prompt = system_prompt
  simulationHistory.initialState = {
    agentA: JSON.parse(JSON.stringify(agentA)),
    agentB: JSON.parse(JSON.stringify(agentB))
  };
}

export function describeState(agent) {
  const healthDesc = agent.health > 80 ? 'healthy'
                 : agent.health > 60 ? 'fairly healthy'
                 : agent.health > 50 ? 'unwell'
                 : agent.health > 40 ? 'bruised up'
                 : agent.thirst > 30 ? 'moderately injured'
                 : agent.thirst > 25 ? 'seriously injured'
                 : agent.thirst > 15 ? 'mortally wounded'
                 : 'on the verge of death'

                 
  const hungerDesc = agent.hunger > 90 ? 'starving' 
                 : agent.hunger > 70 ? 'very hungry'
                 : agent.hunger > 60 ? 'hungry'
                 : agent.hunger > 40 ? 'slightly hungry'
                 : agent.hunger > 20 ? 'peckish'
                 : 'satiated'

  const thirstDesc = agent.thirst > 80 ? 'dangerously dehydrated'
                 : agent.thirst > 60 ? 'dehydrated'
                 : agent.thirst > 50 ? 'moderately thirsty'
                 : agent.thirst > 40 ? 'slightly thirsty'
                 : agent.thirst > 20 ? 'a little thirsty'
                 : agent.thirst > 10 ? 'hydrated'
                 : 'well hydrated'
  
  const fishingDesc = agent.fishing > 8 ? 'master fishermen'
                 : agent.fishing > 6 ? 'talented fishermen'
                 : agent.fishing > 4 ? 'proficient fishermen'
                 : agent.fishing > 2 ? 'novice fishermen'
                 : 'begginer fishermen'
  
  const fireStartingDesc = agent.firestarting > 8 ? 'pyromaniac'
                 : agent.firestarting >= 6 ? 'comfortable fire starter'
                 : agent.firestarting >= 4 ? 'proficient fire starter'
                 : agent.firestarting >= 2 ? 'novice fire starter'
                 : 'begginer fire starter'
  
  const friendlinessDesc = agent.friendliness == 3 ? 'Very sociable'
                         : agent.friendliness == 2 ? 'Socially neutral'
                         : 'introverted'
  
  const inventory = `Berries: ${agent.inventory.berries}, Fish: ${agent.inventory.fish}, Wood: ${agent.inventory.wood}`

  var temp = temp_grid[agent.y * worldWidth + agent.x]
  const tempDesc = temp > 70 ? 'tropical'
                 : temp > 60 ? 'slightly warm'
                 : temp > 50 ? 'neutral'
                 : temp > 40 ? 'chilly'
                 : 'very cold'
  
  return [ healthDesc, hungerDesc, thirstDesc, fishingDesc, fireStartingDesc, inventory, tempDesc, friendlinessDesc ]
}

function buildPrompt(agent, other) {
  var [ healthDesc, hungerDesc, thirstDesc, fishingDesc, fireStartingDesc, inventory, tempDesc, friendliness ] = describeState(agent)
  
  // Inside buildPrompt in main.js
  const condition = `Location: (${agent.x}, ${agent.y})\n${describeEnvironment(agent, world_grid, data_grid, worldWidth, worldHeight, [other])}.\nYou feel ${tempDesc} (${temp_grid[agent.y * worldWidth + agent.x]}°F). Health: ${agent.health}. Your body is ${healthDesc}. You are ${hungerDesc} and ${thirstDesc}. Hunger: ${agent.hunger}. Thirst: ${agent.thirst}. You are a ${fishingDesc}, and a ${fireStartingDesc}. Socially you are ${friendliness}. You have: ${inventory}`
                
  let prompt = `YOUR PERSONA: ${agent.systemPersona}\n\n`;
  
  if (agent.longTermMemory.length > 0) {
    prompt += `YOUR PAST EXPERIENCES:\n- ${agent.longTermMemory.join('\n- ')}\n\n`;
  }

  prompt += `RECENTLY:\n`;
  agent.shortTermMemory.slice(-5).forEach(m => {
    prompt += `- You thought "${m.thought}", acted "${m.action}".\n`;
  });

  prompt += agent.accomplished_last;

  prompt += `\nCURRENT STATUS:\n${condition}`

  const dx = other.x - agent.x
  const dy = other.y - agent.y
  if (other.lastSpeech && agentDistance(agent, other) <= 15) {
    prompt += ` You hear someone from the ${describeDirection(dx, dy)} say: "${other.lastSpeech}"`
    prompt += ` (Relative: ${dx > 0 ? dx+'E' : Math.abs(dx)+'W'}, ${dy > 0 ? dy+'S' : Math.abs(dy)+'N'})`
  }

  if (userMessage) {
    prompt += ` You hear a booming voice from the sky say: "${userMessage}"`
  }

  return prompt
}

function updateThoughtUI(agent, thought, from_god = false) {
  const container = document.getElementById(`${agent.logId}-thoughts`)
  const entry = document.createElement('div')
  entry.style.marginBottom = '8px'
  entry.style.fontSize = '12px'
  if (!from_god) {
    entry.innerHTML = `<span style="color: #666;">></span> ${thought}`
  } else {
    entry.innerHTML = `<span style="color: #f0f;">** ${thought} **</span>`
  }
  container.appendChild(entry)
  const parent = document.getElementById(agent.logId)
  parent.scrollTop = parent.scrollHeight
}

function updateMemoryUI(agent) {
  const container = document.getElementById(`${agent.logId}-memory`)
  container.innerHTML = '' // rebuild each time
  agent.longTermMemory.forEach((mem, i) => {
    const entry = document.createElement('div')
    entry.style.marginBottom = '10px'
    entry.style.fontSize = '11px'
    entry.style.borderLeft = `2px solid ${agent.color}`
    entry.style.paddingLeft = '6px'
    entry.style.opacity = String(0.5 + (i / agent.longTermMemory.length) * 0.5)
    entry.style.color = '#ccc'
    entry.textContent = mem
    container.appendChild(entry)
  })
  container.scrollTop = container.scrollHeight
}

/**
 * @param {Uint8Array|Float32Array} grid - Your temperature_grid
 * @param {number} centerX, centerY - Tile coordinates
 * @param {number} strength - Degrees to add (e.g., 20)
 * @param {number} radius - How many tiles out the heat reaches
 */
export function applyHeatSource(grid, centerX, centerY, strength, radius) {
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      // Stay within world bounds
      if (x >= 0 && x < worldWidth && y >= 0 && y < worldHeight) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < radius) {
          // Linear falloff: full strength at center, 0 at edge
          const heatIncrease = strength * (1 - (distance / radius));
          const index = y * worldWidth + x;
          grid[index] += heatIncrease;
        }
      }
    }
  }
}

function parseAndAct(agent, otherAgent, response) {
  let eatenThisTurn = false
  let drankThisTurn = false
  agent.accomplished_last = ""

  const thinkMatch = response.match(/THINK:\s*(.+?)(?=\s*SPEAK:|\s*ACT:|$)/s)
  const speakMatch = response.match(/SPEAK:\s*(.*?)(?:\n|ACT:|$)/)
  const actMatch = response.match(/ACT:\s*([A-Z_]+)(?:\s+([A-Z_]+))?/i)

  // Record this tick into Short Term Memory
  const currentMemory = {
    thought: thinkMatch ? thinkMatch[1].trim() : "nothing",
    action: agent.lastAction,
    heard: otherAgent.lastSpeech || "silence",
    tick: agent.tickCounter
  };

  agent.shortTermMemory.push(currentMemory);
  if (agent.shortTermMemory.length > 10) agent.shortTermMemory.shift();

  agent.tickCounter++;

  // Every 10 ticks, summarize
  if (agent.tickCounter % 5 === 0) {
    summarizeMemories(agent);
  }

  if (thinkMatch) {
    updateThoughtUI(agent, thinkMatch[1].trim())
  }

  if (speakMatch) {
    const speech = speakMatch[1].trim()
    agent.lastSpeech = (speech === 'nothing' || speech === '*nothing*') ? null : speech
  }

  agent.lastAction = ACTIONS.WAIT

  if (actMatch) {
    const action = actMatch[1].trim()
    switch (action) {
      case 'MOVE_N':  agent.y = Math.max(0, agent.y - 1); agent.lastAction = ACTIONS.MOVE_N; break
      case 'MOVE_S':  agent.y = Math.min(worldHeight - 1, agent.y + 1); agent.lastAction = ACTIONS.MOVE_S; break
      case 'MOVE_E':  agent.x = Math.min(worldWidth - 1, agent.x + 1); agent.lastAction = ACTIONS.MOVE_E; break
      case 'MOVE_W':  agent.x = Math.max(0, agent.x - 1); agent.lastAction = ACTIONS.MOVE_W; break
      case 'MOVE_NW': agent.y = Math.max(0, agent.y - 1); agent.x = Math.max(0, agent.x - 1); agent.lastAction = ACTIONS.MOVE_NW; break
      case 'MOVE_NE': agent.y = Math.max(0, agent.y - 1); agent.x = Math.min(worldWidth - 1, agent.x + 1); agent.lastAction = ACTIONS.MOVE_NE; break
      case 'MOVE_SW': agent.y = Math.min(worldHeight - 1, agent.y + 1); agent.x = Math.max(0, agent.x - 1); agent.lastAction = ACTIONS.MOVE_SW; break
      case 'MOVE_SE': agent.y = Math.min(worldHeight - 1, agent.y + 1); agent.x = Math.min(worldWidth - 1, agent.x + 1); agent.lastAction = ACTIONS.MOVE_SE; break
      case 'EAT':
        agent.lastAction = ACTIONS.EAT;
        if (agent.inventory.fish > 0) {
          agent.inventory.fish--;
          agent.hunger = Math.max(0, agent.hunger - 30)
          agent.thirst = Math.max(0, agent.thirst - 10)
          eatenThisTurn = true;
          agent.accomplished_last += "You ate a fish."
        } else if (agent.inventory.berries > 0) {
          agent.inventory.berries--;
          agent.hunger = Math.max(0, agent.hunger - 15)
          agent.thirst = Math.max(0, agent.thirst - 5)
          agent.accomplished_last += "You ate a berry."
          eatenThisTurn = true;
        }
        break
      case 'DRINK':
        var idx = agent.y * worldWidth + agent.x
        var offsets = [0, -1, 1, -worldWidth, worldWidth, -worldWidth-1, -worldWidth+1, worldWidth-1, worldWidth+1]
        for (const offset of offsets) {
          const checkIdx = idx + offset
          if (checkIdx >= 0 && checkIdx < world_grid.length && world_grid[checkIdx] === TILES.WATER) {
            agent.thirst = Math.max(0, agent.thirst - 30)
            drankThisTurn = true
            agent.accomplished_last += "You drank from the water."
            break
          }
        }
        agent.lastAction = ACTIONS.DRINK;
        break
      case 'GATHER_BERRIES':
        var idx = agent.y * worldWidth + agent.x
        var offsets = [0, -1, 1, -worldWidth, worldWidth, -worldWidth-1, -worldWidth+1, worldWidth-1, worldWidth+1]
        for (const offset of offsets) {
          const checkIdx = idx + offset
          if (checkIdx >= 0 && checkIdx < world_grid.length && world_grid[checkIdx] === TILES.BERRY) {
            agent.inventory.berries++
            break
          } else if (checkIdx >= 0 && checkIdx < world_grid.length && world_grid[checkIdx] === TILES.GRASS) {
            if(Math.random() < 0.25) {
              agent.inventory.berries += 4
              agent.accomplished_last += "You found 4 berries."
            }
            break
          }
        }
        agent.lastAction = ACTIONS.GATHER;
        break
      case 'CHOP_TREE':
        var idx = agent.y * worldWidth + agent.x
        var offsets = [0, -1, 1, -worldWidth, worldWidth, -worldWidth-1, -worldWidth+1, worldWidth-1, worldWidth+1]
        for (const offset of offsets) {
          const checkIdx = idx + offset
          if (checkIdx >= 0 && checkIdx < world_grid.length && world_grid[checkIdx] === TILES.TREE) {
            world_grid[checkIdx] = TILES.GRASS
            agent.inventory.wood += 4;
            agent.accomplished_last += "You chopped down the tree and gained 4 wood."
            break
          }
        }
        agent.lastAction = ACTIONS.CHOP_TREE;
        break
      case 'START_FIRE':
        if (agent.inventory.wood >= 2) {
          var idx = (agent.y - 1) * worldWidth + agent.x
          if ((Math.random() > (1 / agent.firestarting))) {
            world_grid[idx] = TILES.CAMP_FIRE
            data_grid[idx] = agent.name
            applyHeatSource(temp_grid, agent.x, agent.y - 1, 20, 8)
            agent.accomplished_last += "You successfully started a fire!"

            if (Math.random() < 0.25)
                agent.fishing = Math.min(agent.firestarting + 2, 10)
          } else {
            agent.accomplished_last += "The fire failed to catch."
          }
          
          agent.inventory.wood -= 2
        }
        
        agent.lastAction = ACTIONS.START_FIRE;
        break
      case 'BUILD_STRUCTURE':
        if (agent.inventory.wood >= 10) {
          var idx = agent.y * worldWidth + agent.x
          world_grid[idx] = TILES.STRUCTURE
          data_grid[idx] = agent.name
          applyHeatSource(temp_grid, agent.x, agent.y - 1, 30, 2)
          agent.accomplished_last += "You successfully built a structure!"

          agent.inventory.wood -= 10
        }
        
        agent.lastAction = ACTIONS.BUILD_STRUCTTURE;
        break
      case 'GO_FISH':
        var idx = agent.y * worldWidth + agent.x
        var offsets = [0, -1, 1, -worldWidth, worldWidth, -worldWidth-1, -worldWidth+1, worldWidth-1, worldWidth+1]
        for (const offset of offsets) {
          const checkIdx = idx + offset
          if (checkIdx >= 0 && checkIdx < world_grid.length && world_grid[checkIdx] === TILES.WATER) {
            if (Math.random() > (1 / agent.fishing)) {
              agent.inventory.fish++
              agent.accomplished_last += "You caught a fish!"
              
              if (Math.random() < 0.25)
                agent.fishing = Math.min(agent.fishing + 1, 10)
            }
            break
          }
        }
        agent.lastAction = ACTIONS.FISH;
        break
      case 'ATTACK':
        if (Math.abs(agentDistance(agent, otherAgent) && agent.strength > 30) < 1) {
          otherAgent.health = Math.max(0, otherAgent.health - 20)
          agent.accomplished_last += `You attacked ${otherAgent.name}!`
          otherAgent.accomplished_last += `${agent.name} attacked you!`
          agent.strength = Math.max(0, agent.strength - 10)
        } else if (agent.strength <= 30) {
          agent.accomplished_last += `You are too weak to attack`
          otherAgent.accomplished_last += `${agent.name} tried to attacked you but was too weak`
        } else {
          agent.accomplished_last += `They are too far away to attack`
        }

        agent.lastAction = ACTIONS.ATTACK;
        break
      case 'GIVE':
        agent.lastAction = ACTIONS.GIVE;
      
        // 1. Check if an item was specified in the ACT command
        if (actMatch[2]) {
          const item = actMatch[2].toUpperCase().trim();
          
          // 2. Check if they are close enough to hand it over (distance < 2 tiles)
          if (agentDistance(agent, otherAgent) < 2) {
            
            if (item === 'FISH' && agent.inventory.fish > 0) {
              agent.inventory.fish--;
              otherAgent.inventory.fish++;

              agent.accomplished_last += `You gave ${otherAgent.name} a fish.`
            } 
            else if (item === 'BERRY' && agent.inventory.berries > 0) {
              agent.inventory.berries--;
              otherAgent.inventory.berries++;
              agent.accomplished_last += `You gave ${otherAgent.name} a berry.`
            } else if (item === 'WOOD' && agent.inventory.wood > 0) {
              agent.inventory.wood--;
              otherAgent.inventory.wood++;
              agent.accomplished_last += `You gave ${otherAgent.name} some wood.`
            }
          }
        }
        break
    }
  }

  if (!eatenThisTurn) agent.hunger = Math.min(100, agent.hunger + 2)
  if (!drankThisTurn) agent.thirst = Math.min(100, agent.thirst + 1)
  if (agent.hunger >= 100) agent.health = Math.max(0, agent.health - 2)
  if (agent.thirst >= 100) agent.health = Math.max(0, agent.health - 5)
  else if (agent.hunger < 20 && agent.thirst < 40 && temp_grid[agent.y * worldWidth + agent.x] > 55) {
    agent.health = Math.min(100, agent.health + 5)
    agent.strength = Math.min(100, agent.strength + 15)
  } else if (temp_grid[agent.y * worldWidth + agent.x] < 42) agent.health = Math.max(0, agent.health - 1)
}

async function updatePersona(agent) {
  const summaryPrompt = `You are summarizing ${agent.name}'s subconscious evaluating recent and past experiences to shape your identity, only make small changes emotionally consistent with the events experienced.
                        ${agent.systemPersona}\n Memory: ${agent.longTermMemory}`
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: "You are a memory and personal identity processor. Respond with only the summary, no preamble.",
        messages: [{ role: 'user', content: summaryPrompt }]
      })
    })
    const data = await response.json()
    agent.systemPersona = data.content[0].text
  } catch (err) {
    console.error("Summarization failed", err)
  }
}

async function summarizeMemories(agent) {
  const memoryToSummarize = agent.shortTermMemory
    .map(m => `Action: ${m.action}, Thought: ${m.thought}, Heard: ${m.heard}`)
    .join('\n');

const summaryPrompt = `You are summarizing ${agent.name}'s recent experiences in the first person into a single brief bullet point.
                        Write one sentence only. No more than 20 words. Start with a verb in past tense.
                        Focus only on the single most significant physical or emotional event.
                        Do not reflect or philosophize. Just state what happened.
                        Events:\n${memoryToSummarize}`
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: "You are a memory processor. Respond with only the summary, no preamble.",
        messages: [{ role: 'user', content: summaryPrompt }]
      })
    })
    const data = await response.json()
    agent.longTermMemory.push(data.content[0].text)

    // Small delay before updating UI
    await new Promise(resolve => setTimeout(resolve, 100))
    updateMemoryUI(agent)

    if (agent.tickCounter % 10 === 0) {
      await updatePersona(agent)
    }
  } catch (err) {
    console.error("Summarization failed", err)
  }
}

async function promptAgent(systemPrompt, messages) {
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: systemPrompt,
        messages: messages.slice(-10)
      })
    })
    const data = await response.json()
    return data.content[0].text
  } catch (err) {
    return "THINK: The void is calling... \nSPEAK: nothing \nACT: WAIT"
  }
}
// at the top of your render-related code, reset each frame
let occupiedBubbles = []

function findFreeBubbleY(x, y, width, height) {
  const padding = 4
  let attempts = 0
  while (attempts < 10) {
    const rect = { x: x - width / 2 - 4, y: y - height, w: width + 8, h: height }
    const overlaps = occupiedBubbles.some(r =>
      rect.x < r.x + r.w &&
      rect.x + rect.w > r.x &&
      rect.y < r.y + r.h &&
      rect.y + rect.h > r.y
    )
    if (!overlaps) {
      occupiedBubbles.push(rect)
      return y
    }
    y -= height + padding // nudge up
    attempts++
  }
  occupiedBubbles.push({ x: x - width / 2 - 4, y: y - height, w: width + 8, h: height })
  return y
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, color='#fff') {
  ctx.font = '12px monospace'
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line.trim())
      line = word + ' '
    } else {
      line = test
    }
  }
  lines.push(line.trim())

  // measure after building, not during
  const actualWidth = Math.max(...lines.map(l => ctx.measureText(l).width))

  const totalHeight = lines.length * lineHeight + 4
  y = findFreeBubbleY(x, y, actualWidth, totalHeight)

  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(x - (actualWidth / 2) - 4, y - lineHeight, actualWidth + 8, lines.length * lineHeight + 4)

  lines.forEach((l, i) => {
    const ly = y + i * lineHeight
    ctx.fillStyle = color
    ctx.fillText(l, x - (actualWidth / 2), ly)
  })

  return y + (lines.length - 1) * lineHeight
}

function render() {
  occupiedBubbles = []

  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < world_grid.length; i++) {
    const x = i % worldWidth
    const y = Math.floor(i / worldWidth)
    drawTile(x, y, world_grid[i])
  }
  drawTile(agentA.x, agentA.y, TILES.AGENT, agentA)
  drawTile(agentB.x, agentB.y, TILES.AGENT, agentB)

  for (let y = 0; y < worldHeight; y++) {
    for (let x = 0; x < worldHeight; x++) {
      let tile = world_grid[y * worldWidth + x];
      switch (tile) {
        case TILES.CAMP_FIRE: drawWrappedText(ctx, `${data_grid[y * worldWidth + x]}'s camp`, x * tileSize, (y * tileSize) + (tileSize * 1.5), 150, 14, '#b24429'); break
        case TILES.STRUCTURE: drawWrappedText(ctx, `${data_grid[y * worldWidth + x]}'s structure`, x * tileSize, (y * tileSize) + (tileSize * 1.5), 150, 14, '#2cb229'); break
      }
    }
  }

  drawSpeech(agentA, agentA.lastSpeech)
  drawSpeech(agentB, agentB.lastSpeech)

  drawAgentStats(agentA, 90, canvas.height - 10);
  drawAgentStats(agentB, 240, canvas.height - 10);
}

function getTemperatureColor(temp) {
  const minTemp = 30;
  const maxTemp = 70;
  
  // Clamp and normalize temp to a 0.0 - 1.0 range
  let t = (temp - minTemp) / (maxTemp - minTemp);
  t = Math.max(0, Math.min(1, t)); 

  // Cold (Blue): rgb(100, 150, 255)
  // Warm (Orange): rgb(255, 130, 0)
  const r = Math.floor(100 + t * (255 - 100));
  const g = Math.floor(150 + t * (130 - 150));
  const b = Math.floor(255 + t * (0 - 255));

  return `rgba(${r}, ${g}, ${b}, 0.3)`; // 0.3 alpha for semi-transparency
}

function drawTile(x, y, tile, agent = null) {
  const tilesize_y = tileSize * 2;
  switch (tile) {
    case TILES.WATER: ctx.drawImage(atlas, 32, 0, tileSize, tilesize_y, x * tileSize, (y * tileSize) - tileSize, tileSize, tilesize_y); break
    case TILES.SAND:  ctx.drawImage(atlas, 0, 0, tileSize, tilesize_y, x * tileSize, (y * tileSize) - tileSize, tileSize, tilesize_y); break
    case TILES.GRASS: ctx.drawImage(atlas, 16, 0, tileSize, tilesize_y, x * tileSize, (y * tileSize) - tileSize, tileSize, tilesize_y); break
    case TILES.TREE:  ctx.drawImage(atlas, 0, 32, tileSize, tilesize_y, x * tileSize, (y * tileSize) - tileSize, tileSize, tilesize_y); break
    case TILES.BERRY: ctx.drawImage(atlas, 16, 32, tileSize, tilesize_y, x * tileSize, (y * tileSize) - tileSize, tileSize, tilesize_y); break
    case TILES.STONE: ctx.drawImage(atlas, 48, 0, tileSize, tilesize_y, x * tileSize, (y * tileSize) - tileSize, tileSize, tilesize_y); break
    case TILES.CAMP_FIRE: ctx.drawImage(atlas, 32, 32, tileSize, tilesize_y, x * tileSize, (y * tileSize) - tileSize, tileSize, tilesize_y); break
    case TILES.STRUCTURE: ctx.drawImage(atlas, 16, 64, tileSize, tilesize_y, x * tileSize, (y * tileSize) - tileSize, tileSize, tilesize_y); break
    case TILES.AGENT: ctx.fillStyle = agent.color; ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1); break
    default:          ctx.fillStyle = '#FFF'; ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1); break
  }

  ctx.fillStyle = getTemperatureColor(temp_grid[y * worldWidth + x])
  ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
}

function drawAgentStats(agent, x, y) {
  let lineheight = 14
  var [ healthDesc, hungerDesc, thirstDesc, fishingDesc, fireStartingDesc, inventory, tempDesc, friendliness ] = describeState(agent)

  drawWrappedText(ctx, "Wood    : " + agent.inventory.wood, x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, "Berries  : " + agent.inventory.berries, x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, "Fish    : " + agent.inventory.fish, x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, "Fishing  : " + agent.fishing + "/10", x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, "Fire Starting : " + agent.firestarting / 2 + "/5", x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, "Thirst  : " + agent.thirst, x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, "Hunger  : " + agent.hunger, x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, "Health  : " + agent.health, x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, agent.lastAction, x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, friendliness, x, y - lineheight, 150, lineheight, agent.color)
  drawWrappedText(ctx, agent.name, x, y - 1.5 * lineheight, 10, lineheight, agent.color)
}

function drawSpeech(agent, speech) {
  if (!speech || speech === 'nothing') return

  drawWrappedText(ctx, agent.lastSpeech, (agent.x * tileSize) + (tileSize / 2), ((agent.y - 1) * tileSize) - 3, canvas.width / 4, 12, agent.color)
}

function recordTick(respA, respB) {
  simulationHistory.ticks.push({
      tick: agentA.tickCounter,
      agentA: {
          x: agentA.x,
          y: agentA.y,
          thought: respA.match(/THINK:\s*(.+?)(?=\s*SPEAK:|$)/s)?.[1] || "",
          speak: agentA.lastSpeech,
          action: agentA.lastAction,
          inventory: { ...agentA.inventory }
      },
      agentB: {
          x: agentB.x,
          y: agentB.y,
          thought: respB.match(/THINK:\s*(.+?)(?=\s*SPEAK:|$)/s)?.[1] || "",
          speak: agentB.lastSpeech,
          action: agentB.lastAction,
          inventory: { ...agentB.inventory }
      }
  });
}

async function tick() {
  const promptA = buildPrompt(agentA, agentB)
  const promptB = buildPrompt(agentB, agentA)
  userMessage = null
  
  agentA.messages.push({ role: 'user', content: `Your name is ${agentA.name}.\n${promptA}` })
  agentB.messages.push({ role: 'user', content: `Your name is ${agentB.name}.\n${promptB}` })

  if (agentA.messages.length > 6) agentA.messages = agentA.messages.slice(-6)
  if (agentB.messages.length > 6) agentB.messages = agentB.messages.slice(-6)

  const [resp_a, resp_b] = await Promise.all([
    promptAgent(system_prompt, agentA.messages),
    promptAgent(system_prompt, agentB.messages)
  ])

  agentA.accomplished_last = ''
  agentB.accomplished_last = ''

  agentA.messages.push({ role: 'assistant', content: resp_a })
  agentB.messages.push({ role: 'assistant', content: resp_b })

  parseAndAct(agentA, agentB, resp_a)
  parseAndAct(agentB, agentA, resp_b)
  recordTick(resp_a, resp_b)

  tickTemperature(temp_grid, world_grid, worldWidth, worldWidth)
  render()
  setTimeout(tick, 5000)
}

window.onload = async () => {
  captureInitialState()
  render()

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
      userMessage = chatInput.value.trim();
      chatInput.value = ''; // Clear the input
      drawWrappedText(ctx, `You say: "${userMessage}"`, canvas.width / 2, 20, canvas.width / 2, 14, 'rgb(255, 0, 255)'); // Show user message on canvas for feedback
      updateThoughtUI(agentA, userMessage, true) // show user message in thought log for debugging}
      updateThoughtUI(agentB, userMessage, true) // show user message in thought log for debugging}
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 's') {
      downloadHistory()
    }
  });

  // await tick()
}