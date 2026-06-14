import { describe, it, expect } from 'vitest';
import { getUserData } from './utils.js';

describe('getUserData', () => {
  it('should extract id, name, and ready properties from socket.data', () => {
    const mockSocket = {
      data: {
        id: 123,
        name: 'TestUser',
        ready: true,
        extraProperty: 'should be ignored'
      }
    };

    const result = getUserData(mockSocket);

    expect(result).toEqual({
      id: 123,
      name: 'TestUser',
      ready: true
    });
  });

  it('should handle missing properties in socket.data by returning undefined for them', () => {
    const mockSocket = {
      data: {
        id: 456
      }
    };

    const result = getUserData(mockSocket);

    expect(result).toEqual({
      id: 456,
      name: undefined,
      ready: undefined
    });
  });

  it('should handle empty socket.data object', () => {
    const mockSocket = {
      data: {}
    };

    const result = getUserData(mockSocket);

    expect(result).toEqual({
      id: undefined,
      name: undefined,
      ready: undefined
    });
  });

  it('should throw an error if socket.data is undefined', () => {
    const mockSocket = {};

    expect(() => getUserData(mockSocket)).toThrowError(TypeError);
  });
});
