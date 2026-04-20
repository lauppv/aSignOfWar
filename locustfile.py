"""
Load test for aSignOfWar — focused on heavy write operations.

Run:
    locust -f locustfile.py --host http://localhost:3000

Open http://localhost:8089 and start with:
    - 20 users, spawn rate 2  → moderate
    - 50 users, spawn rate 5  → heavy
"""

import random
import string
from locust import HttpUser, task, between

# All registered usernames so players can message each other
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
        self._discover_ghosts()

    def _load_city(self):
        r = self.client.get("/api/cities/mine", headers=self.headers, name="[setup] city")
        if r.status_code == 200:
            data = r.json()
            self.city_id = data.get("id")
            self.building_ids = [b["id"] for b in data.get("buildings", [])]
            units = data.get("units", [])
            self.has_units = any(u["quantity"] > 0 for u in units if u["name"] == "LIGHT_INFANTRY")

    def _discover_ghosts(self):
        r = self.client.get("/api/map", headers=self.headers, name="[setup] map")
        if r.status_code == 200:
            cities = r.json().get("cities", [])
            self.ghost_ids = [c["id"] for c in cities if c.get("owner") is None]

    # ── Building upgrades ──

    @task(8)
    def upgrade_building(self):
        """Upgrade a random building — DB transaction + BullMQ job scheduling."""
        if not self.token or not self.building_ids:
            return
        bid = random.choice(self.building_ids)
        with self.client.post(
            f"/api/buildings/{bid}/upgrade",
            headers=self.headers,
            catch_response=True,
            name="POST /buildings/:id/upgrade",
        ) as r:
            # 400/409 = expected (insufficient resources, upgrade in progress, max level)
            if r.status_code in (200, 400, 409):
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    # ── Unit recruitment ──

    @task(8)
    def recruit_units(self):
        """Recruit infantry — DB transaction + BullMQ job scheduling."""
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

    # ── Attack commands ──

    @task(6)
    def send_attack(self):
        """Send attack to ghost city — travel time calc + DB transaction + BullMQ delayed job."""
        if not self.token or not self.city_id or not self.ghost_ids:
            return
        target = random.choice(self.ghost_ids)
        units = {"LIGHT_INFANTRY": random.randint(1, 5)}
        with self.client.post(
            f"/api/cities/{self.city_id}/commands",
            json={"type": "ATTACK", "targetCityId": target, "units": units},
            headers=self.headers,
            catch_response=True,
            name="POST /commands [ATTACK]",
        ) as r:
            # 400 = no units available, insufficient — expected
            if r.status_code in (201, 400):
                r.success()
            else:
                r.failure(f"{r.status_code} {r.text[:100]}")

    # ── Spy commands ──

    @task(3)
    def send_spy(self):
        """Send spy to ghost city."""
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

    # ── Resource sending ──

    @task(3)
    def send_resources(self):
        """Send resources to a ghost city (requires Harbor, will likely fail — tests the path)."""
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

    # ── Direct messages ──

    @task(6)
    def send_message(self):
        """Send a direct message to another load test player."""
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
        """List conversation threads."""
        if not self.token:
            return
        self.client.get(
            "/api/messages/direct/conversations",
            headers=self.headers,
            name="GET /messages/direct/conversations",
        )

    @task(2)
    def check_unread(self):
        """Check unread message count."""
        if not self.token:
            return
        self.client.get(
            "/api/messages/direct/unread",
            headers=self.headers,
            name="GET /messages/direct/unread",
        )

    # ── Polling (realistic background traffic) ──

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
