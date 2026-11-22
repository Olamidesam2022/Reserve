import { useEffect, useState } from 'react';

let dataDragonVersion = '14.24.1';

export function useDataDragon() {
  const [version, setVersion] = useState(dataDragonVersion);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then((response) => {
        if (!response.ok) throw new Error('Data Dragon versions unavailable');
        return response.json() as Promise<string[]>;
      })
      .then(async (versions) => {
        const latest = versions[0];
        const response = await fetch(
          `https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`,
        );
        if (!response.ok) throw new Error('Data Dragon champions unavailable');
        const payload = (await response.json()) as {
          data: Record<string, { id: string; name: string }>;
        };
        if (active) {
          dataDragonVersion = latest;
          setVersion(latest);
          setNames(
            Object.fromEntries(
              Object.values(payload.data).map((champion) => [champion.id, champion.name]),
            ),
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return { version, names };
}

export function currentDataDragonVersion() {
  return dataDragonVersion;
}
