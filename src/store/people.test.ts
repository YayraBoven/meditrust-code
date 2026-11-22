import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_PROFILE } from '../data/demo';
import type { CheckResult } from '../data/types';
import { migrateState, useApp } from './useApp';

const result = { medicineIds: ['x'], prescribed: false, level: 'low', flags: [], checksRun: [], unassessed: [], unknownRxStatus: [] } as CheckResult;
const st = () => useApp.getState();

describe('several people on one phone', () => {
  beforeEach(() => st().resetAll());

  it('the first saved profile becomes the first person', () => {
    st().setProfile({ ...EMPTY_PROFILE, name: 'Abena', age: 26 });
    expect(st().people).toHaveLength(1);
    expect(st().people[0].profile.name).toBe('Abena');
    expect(st().activeId).toBe(st().people[0].id);
  });

  it('adding a person starts them blank and keeps the first one', () => {
    st().setProfile({ ...EMPTY_PROFILE, name: 'Abena' });
    st().addPerson();
    expect(st().profile.name).toBe('');
    st().setProfile({ ...EMPTY_PROFILE, name: 'Esi' });
    expect(st().people.map((p) => p.profile.name)).toEqual(['Abena', 'Esi']);
  });

  it('each person keeps their own past checks', () => {
    st().setProfile({ ...EMPTY_PROFILE, name: 'Abena' });
    const abena = st().activeId!;
    st().addHistory(result);
    st().addPerson();
    st().setProfile({ ...EMPTY_PROFILE, name: 'Esi' });
    expect(st().history).toHaveLength(0);
    st().switchPerson(abena);
    expect(st().profile.name).toBe('Abena');
    expect(st().history).toHaveLength(1);
  });

  it('removing the active person switches to another; removing the last goes back to welcome', () => {
    st().setOnboarded(true);
    st().setProfile({ ...EMPTY_PROFILE, name: 'Abena' });
    st().addPerson();
    st().setProfile({ ...EMPTY_PROFILE, name: 'Esi' });
    st().removePerson(st().activeId!);
    expect(st().profile.name).toBe('Abena');
    st().removePerson(st().activeId!);
    expect(st().people).toHaveLength(0);
    expect(st().onboarded).toBe(false);
  });

  it('a demo patient is its own person and never overwrites a real profile', () => {
    st().setProfile({ ...EMPTY_PROFILE, name: 'Abena' });
    st().openDemoPerson('ama', { ...EMPTY_PROFILE, name: 'Ama', pregnancy: 'pregnant', trimester: 1 });
    expect(st().demoId).toBe('ama');
    expect(st().people.find((p) => p.profile.name === 'Abena')).toBeTruthy();
    st().openDemoPerson('ama', { ...EMPTY_PROFILE, name: 'Ama', pregnancy: 'pregnant', trimester: 1 });
    expect(st().people.filter((p) => p.demoId === 'ama')).toHaveLength(1); // opened twice, still one
  });

  it('upgrading a phone that had one profile keeps it as the first person', () => {
    const old = { onboarded: true, profile: { ...EMPTY_PROFILE, name: 'Yayra' }, history: [{ id: 'chk_1', at: '', result }], demoId: null };
    const s = migrateState(old, 0);
    expect(s.people).toHaveLength(1);
    expect(s.people[0].profile.name).toBe('Yayra');
    expect(s.people[0].history).toHaveLength(1);
    expect(s.activeId).toBe(s.people[0].id);
    expect(migrateState({ onboarded: false }, 0).people).toEqual([]);
  });
});
