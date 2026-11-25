# Game rules (enforced by the server)

These match the original prototype (`frontend/prototype.html`). The backend implements them as pure
functions in `backend/src/game.ts`, and the frontend uses them only to explain what's happening.

## Setup
* 25 words drawn at random from the word list (`backend/src/words.ts`, at least 400 words, all UPPERCASE, single words).
* The starting team is chosen at random. The key has **9** cards for the starting team, **8** for the other, **7** neutral and **1** assassin, shuffled.
* Use a proper Fisher–Yates shuffle with `crypto.randomInt`, not `sort(() => Math.random() - .5)`.

## Teams
* Two teams, red (`r`, shown with ▲ and stripes) and blue (`b`, ● and dots).
* Each team needs exactly **1 spymaster** and **at least 1 agent** before the host can start.

## A turn
1. The current team's spymaster gives a clue: **one word** and a **number from 0 to 9**.
   * The word is trimmed and uppercased, and can't contain whitespace.
   * It's invalid if it equals an unrevealed board word, or if either one contains the other and both are longer than 2 letters.
   * The number can't be larger than the team's remaining cards. 0 means unlimited guesses.
2. The current team's agents guess one card at a time:
   * **Own colour:** `guessesThisTurn += 1`. If `number > 0` and `guessesThisTurn ≥ number + 1`, the turn ends.
   * **Neutral or the other team's colour:** the turn ends at once.
   * **Assassin:** the game ends and the **other** team wins (`reason: 'assassin'`).
   * If the reveal leaves a team (either one) with 0 cards remaining, **that team wins** (`reason: 'cleared'`).
     This is checked before the turn-end rules.
3. After at least one guess, agents can end the turn voluntarily (`turn:end`).

Ending a turn means: `turn` flips, `turnNo += 1`, `guessesThisTurn = 0`, `clue = null`, and the timer restarts.

## Timer
* `settings.timer` seconds per turn (0 = off). It covers the whole turn, clue plus guesses.
* The server runs it. When `turnEndsAt` passes, the server ends the turn and sends `room:event {kind:'timeout'}`.

## Game over
* `phase = 'over'`, the key is revealed to everyone, and `stats` is filled in:
  * `turns` = `turnNo`
  * `found` = revealed red and blue cards
  * `topFinders` = players who revealed the most cards of **their own** team's colour (top 3)
  * `bestClue` = the clue with the highest `hits`
* The host can start a rematch: new board, same seats, back to `lobby`.
