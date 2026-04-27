import { agentDistance, applyHeatSource, describeState } from './main.js'
import { noise2D } from './noise.js'

export const tileSize = 16
export const worldWidth = 50
export const worldHeight = 50

export const TILES = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  STONE: 3,
  TREE: 4,
  BERRY: 5,
  CAMP_FIRE: 6,
  STRUCTURE: 7,
  FARM_SEED: 8,
  FARM_GROWN: 9,
  AGENT: 10
}

export function generateWorld(width, height) {
  const grid = new Uint8Array(width * height)
  const temp = new Uint8Array(width * height)
  const data = new Array(width * height)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = noise2D(x * 0.05, y * 0.05)
      const t = (noise2D(x * 0.06, y * 0.06) * 48) + 45;
      
      let tile
      if (n < -0.3)      tile = TILES.WATER
      else if (n < -0.1) tile = TILES.SAND
      else if (n < 0.4) {
        if (Math.random() < 0.1 && t > 40)        tile = TILES.TREE
        else if (Math.random() < 0.05 && t > 30 ) tile = TILES.BERRY
        else                                      tile = TILES.GRASS
      } else tile = TILES.STONE
      
      grid[y * width + x] = tile
      temp[y * width + x] = t
      data[y * width + x] = 0
    }
  }
  return [ grid, temp, data ]
}

var ticks = 0;
export function tickTemperature(temp_grid, world_grid, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      temp_grid[y * width + x] = (noise2D((x * 0.06) + (ticks / 50), (y * 0.06) + (ticks / 50)) * 48) + 45;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (world_grid[y * width + x] === TILES.CAMP_FIRE) {
        applyHeatSource(temp_grid, x, y, 20, 8);
      } else if (world_grid[y * width + x] === TILES.STRUCTURE) {
        applyHeatSource(temp_grid, x, y, 30, 1);
      }
    }
  }

  ticks++;
}

export function describeDirection(dx, dy) {
  let vertical = "";
  let horizontal = "";

  if (dy < 0) vertical = "north";
  if (dy > 0) vertical = "south";
  if (dx < 0) horizontal = "west";
  if (dx > 0) horizontal = "east";

  if (vertical && horizontal) return vertical + horizontal; // e.g., "northwest"
  return vertical || horizontal || "here";
}

export function describeEnvironment(agent, grid, data_grid, width, height, others = []) {
  const TILE_NAMES = {
    0: 'water',
    1: 'sandy shore',
    2: 'grass',
    3: 'rock',
    4: 'dense trees',
    5: 'berry bushes',
    6: 'campfire',
    7: 'structure',
    8: 'growing farmland',
    9: 'wheat ready to harvist'
  }

  const standing = TILE_NAMES[grid[agent.y * width + agent.x]]
  const closest = {}

  for (let dy = -agent.sight; dy <= agent.sight; dy++) {
    for (let dx = -agent.sight; dx <= agent.sight; dx++) {
      if (dx === 0 && dy === 0) continue
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > agent.sight) continue

      const nx = agent.x + dx
      const ny = agent.y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue

      const tile = grid[ny * width + nx]
      if (tile === TILES.GRASS) continue

      if (!closest[tile] || dist < closest[tile].dist) {
        closest[tile] = { dist, dx, dy }
      }
    }
  }

  const parts = Object.entries(closest).map(([tile, { dist, dx, dy }]) => {
    const name = TILE_NAMES[tile]
    const dir = describeDirection(dx, dy)
    return `${tile === TILES.STRUCTURE || tile === TILES.CAMP_FIRE ? data_grid[(agent.y + dy) * width + (agent.x + dx)] + "'s": ''}${name} ${Math.round(dist)} tiles away to the ${dir}`
  })

  for (const other of others) {
    const dx = other.x - agent.x
    const dy = other.y - agent.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > agent.sight) continue

    var [ healthDesc, hungerDesc, thirstDesc, fishingDesc, fireStartingDesc, inventory, tempDesc, friendliness ] = describeState(agent)

    const range = dist < 2 ? 'right beside you'
                : dist < 4 ? 'nearby'
                : dist < 6 ? 'in the distance'
                : 'far away'
    const dir = describeDirection(dx, dy)
    parts.push(`another person ${range} ${agentDistance(agent, other)} to the ${dir}`)
    parts.push(` (Relative: ${dx > 0 ? dx+'E' : Math.abs(dx)+'W'}, ${dy > 0 ? dy+'S' : Math.abs(dy)+'N'})`)
    parts.push(`They look ${healthDesc}, ${hungerDesc}`)
  }

  const surroundings = parts.length
    ? parts.join(', ')
    : 'nothing but grass in every direction'

  return `You are standing on ${standing}. You can see: ${surroundings}.`
}