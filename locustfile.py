"""
Load test for aSignOfWar.

Run:
    locust -f locustfile.py --host http://localhost:3000


"""

import random
import string
from locust import HttpUser, task, between

# Toti userii inregistrati — ca sa poata trimite mesaje intre ei
ALL_USERNAMES: list[str] = []


def random_str(n=10):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


class GamePlayer(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        suffix = random_str()
        self.username = f"lt_{suffix}"
        payload = {
            "username": self.username,
            "email": f"{self.username}@loadtest.local",
            "password": "loadtest123",
            "cityName": f"City {suffix}",
        }
        with self.client.post("/api/auth/register", json=payload, catch_response=True) as r:
            if r.status_code == 201:
                self.token = r.json()["token"]
                ALL_USERNAMES.append(self.username)
                r.success()
            else:
                r.failure(f"Register: {r.status_code}")
                self.token = None
                return

        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.city_id = None
        self.building_ids = []
        self.ghost_ids = []
        self.has_units = False

        self._load_city()

    # -- Helpers --

    def _load_city(self):
        r = self.client.get("/api/cities/mine", headers=self.headers, name="GET /cities/mine")
        if r.status_code == 200:
            data = r.json()
            self.city_id = data.get("id")
            self.building_ids = [b["id"] for b in data.get("buildings", [])]
            units = data.get("units", [])
            self.has_units = any(u["quantity"] > 0 for u in units if u["name"] == "LIGHT_INFANTRY")

    def _refresh_ghosts_from_map(self, response_json):
        """Extrage ghost city ids din raspunsul de la GET /map."""
        cities = response_json.get("cities", [])
        self.ghost_ids = [c["id"] for c in cities if c.get("owner") is None]

    # -- Harta (cel mai greu endpoint — incarca toate orasele) --

    @task(3)
    def poll_map(self):
        """GET /map — intr-un joc real userii dau refresh la harta periodic."""
        if not self.token:
            return
        with self.client.get("/api/map", headers=self.headers, catch_response=True, name="GET /map") as r:
            if r.status_code == 200:
                self._refresh_ghosts_from_map(r.json())
                r.success()
            else:
                r.failure(f"{r.status_code}")

    # -- Building upgrades --

    @task(8)
    def upgrade_building(self):
        if not self.token or not self.building_ids:
            return
        bid = random.choice(self.building_ids)
        with self.client.post(
            f"/api/buildings/{bid}/upgrade",
            headers=self.headers,
            catch_response=True,
            name="POST /buildings/:id/upgrade",
        ) as r:
            if r.status_code in (200, 400, 409):
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    # -- Unit recruitment --

    @task(8)
    def recruit_units(self):
        if not self.token or not self.city_id:
            return
        unit = random.choice(["LIGHT_INFANTRY", "HEAVY_INFANTRY", "DEFENDER_INFANTRY"])
        with self.client.post(
            f"/api/cities/{self.city_id}/recruit",
            json={"unitName": unit, "quantity": random.randint(1, 10)},
            headers=self.headers,
            catch_response=True,
            name="POST /cities/:cityId/recruit",
        ) as r:
            if r.status_code in (200, 201, 400):
                if r.status_code in (200, 201):
                    self.has_units = True
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    # -- Commands (attack, spy, resources) --

    @task(6)
    def send_attack(self):
        if not self.token or not self.city_id or not self.ghost_ids:
            return
        target = random.choice(self.ghost_ids)
        with self.client.post(
            f"/api/cities/{self.city_id}/commands",
            json={"type": "ATTACK", "targetCityId": target, "units": {"LIGHT_INFANTRY": random.randint(1, 5)}},
            headers=self.headers,
            catch_response=True,
            name="POST /commands [ATTACK]",
        ) as r:
            if r.status_code in (201, 400):
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    @task(3)
    def send_spy(self):
        if not self.token or not self.city_id or not self.ghost_ids:
            return
        target = random.choice(self.ghost_ids)
        with self.client.post(
            f"/api/cities/{self.city_id}/commands",
            json={"type": "SPY", "targetCityId": target, "units": {"HACKER": 1}},
            headers=self.headers,
            catch_response=True,
            name="POST /commands [SPY]",
        ) as r:
            if r.status_code in (201, 400):
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    @task(3)
    def send_resources(self):
        if not self.token or not self.city_id or not self.ghost_ids:
            return
        target = random.choice(self.ghost_ids)
        with self.client.post(
            f"/api/cities/{self.city_id}/commands",
            json={
                "type": "RESOURCES",
                "targetCityId": target,
                "resources": {"money": 10, "energy": 10, "ammo": 10},
            },
            headers=self.headers,
            catch_response=True,
            name="POST /commands [RESOURCES]",
        ) as r:
            if r.status_code in (201, 400):
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    @task(2)
    def cancel_command(self):
        """Incearca sa anuleze o comanda — testeaza si path-ul de cancel."""
        if not self.token or not self.city_id:
            return
        r = self.client.get(
            f"/api/cities/{self.city_id}/commands",
            headers=self.headers,
            name="GET /cities/:cityId/commands",
        )
        if r.status_code != 200:
            return
        commands = r.json() if isinstance(r.json(), list) else r.json().get("commands", [])
        traveling = [c for c in commands if c.get("status") == "TRAVELING"]
        if not traveling:
            return
        cmd = random.choice(traveling)
        with self.client.post(
            f"/api/cities/{self.city_id}/commands/{cmd['id']}/cancel",
            headers=self.headers,
            catch_response=True,
            name="POST /commands/:id/cancel",
        ) as r2:
            if r2.status_code in (200, 400, 404):
                r2.success()
            else:
                r2.failure(f"{r2.status_code} {r2.text[:100]}")

    # -- Direct messages --

    @task(6)
    def send_message(self):
        if not self.token or len(ALL_USERNAMES) < 2:
            return
        candidates = [u for u in ALL_USERNAMES if u != self.username]
        if not candidates:
            return
        target = random.choice(candidates)
        with self.client.post(
            "/api/messages/direct",
            json={"toUsername": target, "content": f"Load test message {random_str(6)}"},
            headers=self.headers,
            catch_response=True,
            name="POST /messages/direct",
        ) as r:
            if r.status_code in (201, 400, 404):
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    @task(3)
    def read_conversations(self):
        if not self.token:
            return
        self.client.get(
            "/api/messages/direct/conversations",
            headers=self.headers,
            name="GET /messages/direct/conversations",
        )

    @task(2)
    def check_unread(self):
        if not self.token:
            return
        self.client.get(
            "/api/messages/direct/unread",
            headers=self.headers,
            name="GET /messages/direct/unread",
        )

    # -- Polling (trafic de background, ca in jocul real) --

    @task(4)
    def poll_city(self):
        if not self.token:
            return
        self._load_city()

    @task(3)
    def poll_commands(self):
        if not self.token or not self.city_id:
            return
        self.client.get(
            f"/api/cities/{self.city_id}/commands",
            headers=self.headers,
            name="GET /cities/:cityId/commands",
        )

    @task(2)
    def poll_reports(self):
        if not self.token:
            return
        self.client.get("/api/reports", headers=self.headers, name="GET /reports")

    @task(2)
    def poll_rankings(self):
        if not self.token:
            return
        self.client.get("/api/rankings", headers=self.headers, name="GET /rankings")

    # -- Profile & rename (operatii mai rare) --

    @task(1)
    def rename_city(self):
        if not self.token:
            return
        with self.client.patch(
            "/api/cities/mine/name",
            json={"name": f"City {random_str(6)}"},
            headers=self.headers,
            catch_response=True,
            name="PATCH /cities/mine/name",
        ) as r:
            if r.status_code in (200, 400):
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    @task(1)
    def view_player_profile(self):
        """Viziteaza profilul unui alt jucator."""
        if not self.token or len(ALL_USERNAMES) < 2:
            return
        candidates = [u for u in ALL_USERNAMES if u != self.username]
        if not candidates:
            return
        # nu avem user ID-urile, dar putem folosi players endpoint
        self.client.get(
            "/api/rankings",
            headers=self.headers,
            name="GET /rankings [profile browse]",
        )
