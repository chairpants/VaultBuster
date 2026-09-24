// MonsterVision: TNT's Joe Bob Briggs late-night movie block. The catalog
// has it as one "Broadcast Blocks" tape of 76 recorded airings; this splits
// it into one tape per film (The Deliberate Stranger's two parts share a
// tape) in a "MonsterVision" section of its own. Classic script, shared by
// store.js (VAULT_MV.split, before shelving) and fetch-mv-covers.mjs (the
// film list, for TMDB poster lookups) so both always agree on ids.
//
// FILMS: the airing's name as the catalog has it (after "MONSTERVISION - ")
// -> [real title, release year] — the year pins TMDB to the right film.
window.VAULT_MV = (() => {
  const FILMS = {
    "2020 Texas Gladiators": ["2020 Texas Gladiators", 1982],
    "Beastmaster": ["The Beastmaster", 1982],
    "Beastmaster 2": ["Beastmaster 2: Through the Portal of Time", 1991],
    "Beyond Thunderdome": ["Mad Max Beyond Thunderdome", 1985],
    "Big Trouble in Little China": ["Big Trouble in Little China", 1986],
    "Carrie": ["Carrie", 1976],
    "Children of the Corn 2": ["Children of the Corn II: The Final Sacrifice", 1992],
    "Childs Play 2": ["Child's Play 2", 1990],
    "Christine": ["Christine", 1983],
    "Clash of the Titans (TV)": ["Clash of the Titans", 1981],
    "Conan the Barbarian": ["Conan the Barbarian", 1982],
    "Conan the Destroyer": ["Conan the Destroyer", 1984],
    "Critters (TV)": ["Critters", 1986],
    "DamnationAlley": ["Damnation Alley", 1977],
    "DeliberateStrangerPart1": ["The Deliberate Stranger", 1986],
    "DeliberateStrangerPart2": ["The Deliberate Stranger", 1986],
    "Dolores Claiborne": ["Dolores Claiborne", 1995],
    "Duel": ["Duel", 1971],
    "EmbraceOfTheVampire": ["Embrace of the Vampire", 1995],
    "Escape Planet of the Apes": ["Escape from the Planet of the Apes", 1971],
    "Forbidden Planet": ["Forbidden Planet", 1956],
    "Friday the 13th 6": ["Friday the 13th Part VI: Jason Lives", 1986],
    "Funhouse": ["The Funhouse", 1981],
    "FutureHunters": ["Future Hunters", 1986],
    "Ghoulies": ["Ghoulies", 1984],
    "Ghoulies 2": ["Ghoulies II", 1987],
    "Godzilla": ["Godzilla, King of the Monsters!", 1956],
    "Godzilla vs. Mothra": ["Godzilla vs. Mothra", 1992],
    "Hairspray": ["Hairspray", 1988],
    "Halloween 2": ["Halloween II", 1981],
    "Halloween III Season of the Witch (TV)": ["Halloween III: Season of the Witch", 1982],
    "Highlander": ["Highlander", 1986],
    "Howling 3": ["Howling III", 1987],
    "Howling 7": ["Howling: New Moon Rising", 1995],
    "IceCreamMan": ["Ice Cream Man", 1995],
    "ImmortalCombat": ["Immortal Combat", 1994],
    "In Mouth of Madness": ["In the Mouth of Madness", 1994],
    "ItLivesAgain": ["It Lives Again", 1978],
    "ItsAlive": ["It's Alive", 1974],
    "Jaws 2": ["Jaws 2", 1978],
    "Mars Attacks": ["Mars Attacks!", 1996],
    "Mary Shelleys Frankenstein": ["Mary Shelley's Frankenstein", 1994],
    "MaximumOverdrive": ["Maximum Overdrive", 1986],
    "Metalbeast audiofixed": ["Metalbeast", 1995],
    "National Lampoons European Vacation": ["National Lampoon's European Vacation", 1985],
    "Pee Wees Big Adventure": ["Pee-wee's Big Adventure", 1985],
    "People Under the Stairs": ["The People Under the Stairs", 1991],
    "Pet Shop": ["Pet Shop", 1994],
    "Phantasm": ["Phantasm", 1979],
    "Phantasm 2": ["Phantasm II", 1988],
    "PlanetOfTheApes": ["Planet of the Apes", 1968],
    "Poltergeist": ["Poltergeist", 1982],
    "ReturnOfTheLivingDead": ["The Return of the Living Dead", 1985],
    "Road Warrior": ["The Road Warrior", 1981],
    "Stepfather": ["The Stepfather", 1987],
    "Swamp Thing": ["Swamp Thing", 1982],
    "Teen Wolf": ["Teen Wolf", 1985],
    "The Devil's Rain": ["The Devil's Rain", 1975],
    "The Exorcist": ["The Exorcist", 1973],
    "The Fear": ["The Fear", 1995],
    "The Fog": ["The Fog", 1980],
    "The Horror at 37,000 Feet": ["The Horror at 37,000 Feet", 1973],
    "The Kiss": ["The Kiss", 1988],
    "The Lost Boys": ["The Lost Boys", 1987],
    "The Seventh Sign": ["The Seventh Sign", 1988],
    "The Surgeon": ["The Surgeon", 1995],
    "The Time Machine": ["The Time Machine", 1960],
    "The Ultimate Warrior": ["The Ultimate Warrior", 1975],
    "The Wasp Woman (1959)": ["The Wasp Woman", 1959],
    "TheBirds": ["The Birds", 1963],
    "TheyLive": ["They Live", 1988],
    "Time After Time": ["Time After Time", 1979],
    "Time Runner": ["Time Runner", 1993],
    "ToTheLimit": ["To the Limit", 1995],
    "Willy Wonka Chocolate Factory": ["Willy Wonka & the Chocolate Factory", 1971],
    "Xmas Part1 Gremlins": ["Gremlins", 1984],
  };
  const slug = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  const idOf = title => `MV-${slug(title)}`;
  // replace the one MonsterVision tape in `catalog` (in place) with a tape per film
  function split(catalog) {
    const i = catalog.findIndex(t => t.id === "MonsterVision");
    if (i < 0) return;
    const [mv] = catalog.splice(i, 1), byFilm = new Map();
    for (const ep of mv.seasons[0].episodes) {
      const raw = ep[1].replace(/^MONSTERVISION - /i, "");
      const [title, year] = FILMS[raw] || [raw.replace(/([a-z])([A-Z])/g, "$1 $2"), 0];   // unknown airings still get a readable name
      if (!byFilm.has(title)) byFilm.set(title, { year, eps: [] });
      byFilm.get(title).eps.push(ep);
    }
    for (const [title, { year, eps }] of byFilm) {
      const id = idOf(title);
      catalog.push({ id, title, category: "MonsterVision", art: mv.art, year,
        seasons: [{ label: eps.length > 1 ? `${eps.length} parts` : "", episodes: eps.map((e, k) =>
          [e[0], `MONSTERVISION - ${title}${eps.length > 1 ? ` (Part ${k + 1})` : ""}`, ...e.slice(2)]) }] });
      if (window.VAULT_META && !window.VAULT_META[id] && year) window.VAULT_META[id] = [year, 0];   // the POS shows the year
    }
  }
  return { FILMS, idOf, split };
})();
