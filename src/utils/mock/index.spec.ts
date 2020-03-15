import { MockFile, generateFile } from './index';

describe('Mock file', () => {
  it('should be defined', () => {
    let file = new (MockFile as any)();
    expect(file).not.toBeNull();
  });

  it('should have default values', () => {
    // @ts-ignore
    let mock = new (MockFile as any)();
    let file = mock.create();
    expect(file.name).toBe('mock.txt');
    expect(file.size).toBe(1024);
  });
});

describe('Mock file for file upload testing', () => {
  it('should be defined', () => {
    let file = generateFile();
    expect(file).not.toBeNull();
  });

  it('should have default values', () => {
    let file = generateFile();
    expect(file.name).toBe('mock.txt');
    expect(file.size).toBe(1024);
  });
});