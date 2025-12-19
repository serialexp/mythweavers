          {/* Right Column */}
          <div class="space-y-4">
            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Main Character</span>
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={
                    charactersState.selectedCharacter?.isMainCharacter ?? true
                  }
                  onChange={(e) => {
                    updateCharacterProperty(
                      charactersState.selectedCharacterId,
                      "isMainCharacter",
                      e.currentTarget.checked,
                    );
                  }}
                />
              </label>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Later Version Of</span>
              </label>
              <CharacterSelect
                placeholder="Select earlier version..."
                value={charactersState.selectedCharacter?.laterVersionOf}
                onChange={(characterId) => {
                  updateCharacterProperty(
                    charactersState.selectedCharacterId,
                    "laterVersionOf",
                    characterId || undefined,
                  );
                }}
                filter={(char) => 
                  // Don't show the current character
                  char.id !== charactersState.selectedCharacterId &&
                  // Don't show characters that are later versions of this character (to avoid cycles)
                  char.laterVersionOf !== charactersState.selectedCharacterId
                }
              />
            </div>

            <div class="form-control"> 