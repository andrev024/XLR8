const store = new Map();

module.exports = {
  getItemAsync: jest.fn((key) =>
    Promise.resolve(store.has(key) ? store.get(key) : null),
  ),
  setItemAsync: jest.fn((key, value) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key) => {
    store.delete(key);
    return Promise.resolve();
  }),
};
