import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialTeams,
  applyScoreDelta,
  overrideScore,
  registerBuzzerPress,
  formatTimer,
  rankTeams,
  determineRoundWinner,
  determineMatchChampion,
  createBigEventOverlay,
} from './scoringLogic.ts';

test('createInitialTeams generates four active teams with 0 points', () => {
  const teams = createInitialTeams();
  assert.equal(teams.length, 4);
  assert.equal(teams[0].score, 0);
  assert.equal(teams[0].code, 'Regu A');
});

test('applyScoreDelta adds positive points and records round score and history', () => {
  const teams = createInitialTeams();
  const { updatedTeams, historyEntry } = applyScoreDelta(teams, 'regu-a', 'round-wajib', 100, 'Jawaban Benar');

  assert.equal(updatedTeams[0].score, 100);
  assert.equal(updatedTeams[0].roundScores['round-wajib'], 100);
  assert.equal(historyEntry.delta, 100);
  assert.equal(historyEntry.prevScore, 0);
  assert.equal(historyEntry.newScore, 100);
  assert.equal(historyEntry.action, 'score_add');
});

test('applyScoreDelta can deduct points on incorrect rebuttal answer', () => {
  const teams = createInitialTeams();
  const step1 = applyScoreDelta(teams, 'regu-b', 'round-rebutan', 100);
  const step2 = applyScoreDelta(step1.updatedTeams, 'regu-b', 'round-rebutan', -50, 'Salah Rebutan');

  assert.equal(step2.updatedTeams[1].score, 50);
  assert.equal(step2.updatedTeams[1].roundScores['round-rebutan'], 50);
  assert.equal(step2.historyEntry.delta, -50);
  assert.equal(step2.historyEntry.action, 'score_deduct');
});

test('overrideScore corrects score directly', () => {
  const teams = createInitialTeams();
  const { updatedTeams, historyEntry } = overrideScore(teams, 'regu-c', 'round-wajib', 250, 'Koreksi Juri');

  assert.equal(updatedTeams[2].score, 250);
  assert.equal(historyEntry.action, 'score_override');
  assert.equal(historyEntry.newScore, 250);
});

test('registerBuzzerPress orders buzzers by time and ignores duplicates', () => {
  const teams = createInitialTeams();
  const queue1 = registerBuzzerPress([], teams[0], false, 1000);
  assert.equal(queue1.isFirst, true);
  assert.equal(queue1.updatedQueue.length, 1);
  assert.equal(queue1.updatedQueue[0].relativeMs, 0);

  const queue2 = registerBuzzerPress(queue1.updatedQueue, teams[1], false, 1340);
  assert.equal(queue2.isFirst, false);
  assert.equal(queue2.updatedQueue.length, 2);
  assert.equal(queue2.updatedQueue[1].relativeMs, 340);

  const queue3 = registerBuzzerPress(queue2.updatedQueue, teams[0], false, 1400);
  assert.equal(queue3.updatedQueue.length, 2);

  const queue4 = registerBuzzerPress(queue2.updatedQueue, teams[2], true, 1500);
  assert.equal(queue4.updatedQueue.length, 2);
});

test('formatTimer formats mm:ss correctly', () => {
  assert.equal(formatTimer(60), '01:00');
  assert.equal(formatTimer(15), '00:15');
  assert.equal(formatTimer(5), '00:05');
  assert.equal(formatTimer(0), '00:00');
  assert.equal(formatTimer(-10), '00:00');
});

test('rankTeams sorts properly by score descending and assigns ranks', () => {
  const teams = createInitialTeams();
  teams[0].score = 150;
  teams[1].score = 300;
  teams[2].score = 200;
  teams[3].score = 150;

  const ranked = rankTeams(teams);
  assert.equal(ranked[0].code, 'Regu B');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].code, 'Regu C');
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].code, 'Regu A');
  assert.equal(ranked[2].rank, 3);
  assert.equal(ranked[3].code, 'Regu D');
  assert.equal(ranked[3].rank, 4);
});

test('determineRoundWinner identifies highest scorer in specific round', () => {
  const teams = createInitialTeams();
  teams[0].roundScores['round-rebutan'] = 100;
  teams[1].roundScores['round-rebutan'] = 250;
  teams[2].roundScores['round-rebutan'] = 50;

  const res = determineRoundWinner(teams, 'round-rebutan');
  assert.ok(res);
  assert.equal(res.winner.code, 'Regu B');
  assert.equal(res.roundScore, 250);
  assert.equal(res.lead, 150);
});

test('determineMatchChampion identifies overall leader', () => {
  const teams = createInitialTeams();
  teams[0].score = 300;
  teams[1].score = 450;
  teams[2].score = 150;

  const res = determineMatchChampion(teams);
  assert.ok(res);
  assert.equal(res.champion.code, 'Regu B');
  assert.equal(res.lead, 150);
});

test('createBigEventOverlay builds correct timer_zero and round_winner overlays', () => {
  const timerOverlay = createBigEventOverlay('timer_zero', { roundName: 'Babak Rebutan' });
  assert.equal(timerOverlay.type, 'timer_zero');
  assert.equal(timerOverlay.title, 'WAKTU HABIS!');

  const teams = createInitialTeams();
  const winnerOverlay = createBigEventOverlay('round_winner', {
    roundName: 'Babak I Wajib',
    team: teams[0],
    roundScore: 200,
    leadPoints: 50,
  });
  assert.equal(winnerOverlay.type, 'round_winner');
  assert.equal(winnerOverlay.winningTeam?.code, 'Regu A');
});
