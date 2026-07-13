"use strict";
// Curated adjective + animal nickname combinations for children.
// No free-text input — children pick from this fixed, pre-approved list.

const ADJECTIVES = [
  "Bouncy", "Brave", "Cheerful", "Cozy", "Curious", "Daring", "Dreamy",
  "Fierce", "Fluffy", "Friendly", "Gentle", "Glittery", "Happy", "Jolly",
  "Lucky", "Magic", "Mighty", "Playful", "Rainbow", "Secret", "Silly",
  "Sneaky", "Sparkly", "Speedy", "Sunny", "Swift", "Tiny", "Wild", "Wise",
  "Cosmic",
];

const ANIMALS = [
  "Bear", "Bunny", "Cheetah", "Dolphin", "Dragon", "Elephant", "Flamingo",
  "Fox", "Giraffe", "Hamster", "Hedgehog", "Kangaroo", "Kitty", "Koala",
  "Lion", "Monkey", "Octopus", "Otter", "Owl", "Panda", "Parrot", "Penguin",
  "Phoenix", "Puppy", "Raccoon", "Squirrel", "Tiger", "Turtle", "Unicorn",
  "Wolf",
];

// Build the full sorted list once at module load.
const ALL_NICKNAMES = [];
for (const adj of ADJECTIVES) {
  for (const animal of ANIMALS) {
    ALL_NICKNAMES.push(`${adj} ${animal}`);
  }
}
ALL_NICKNAMES.sort();

const NICKNAME_SET = new Set(ALL_NICKNAMES);

function getRandomNickname() {
  return ALL_NICKNAMES[Math.floor(Math.random() * ALL_NICKNAMES.length)];
}

function getAllNicknames() {
  return ALL_NICKNAMES;
}

function isValidNickname(str) {
  return typeof str === "string" && NICKNAME_SET.has(str);
}

module.exports = { getRandomNickname, getAllNicknames, isValidNickname, ADJECTIVES, ANIMALS };
