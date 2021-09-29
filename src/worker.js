// import CANNON from 'cannon';
import * as CANNON from 'cannon-es';

const REFRESH_DELTA = 1000 / 60;
const TIME_SCALE = 1;

const world = new CANNON.World();
world.gravity.set(0, -9.81, 0);

const floorShape = new CANNON.Plane()

const floorBody = new CANNON.Body({
    mass: 0,
    shape: floorShape
});
floorBody.quaternion.setFromEuler(-Math.PI * 0.5, 0, 0);

world.addBody(floorBody);

const bodies = []

let oldTickStart;

const tick = () => {
    const tickStart = performance.now();
    const deltaTime = (tickStart - oldTickStart);

    world.step(REFRESH_DELTA * TIME_SCALE * 0.001, deltaTime * TIME_SCALE * 0.001, 3);
    
    setTimeout(tick, REFRESH_DELTA - (performance.now() - tickStart));
    oldTickStart = tickStart;
}

oldTickStart = performance.now();
tick();

self.onmessage = (message) => {
    if (message.data.operation === 'request_frame') {
        const { positions, quaternions } = message.data;

        bodies.forEach((body, index) => {
            positions[index * 3 + 0] = body.position.x;
            positions[index * 3 + 1] = body.position.y;
            positions[index * 3 + 2] = body.position.z;
            quaternions[index * 4 + 0] = body.quaternion.x;
            quaternions[index * 4 + 1] = body.quaternion.y;
            quaternions[index * 4 + 2] = body.quaternion.z;
            quaternions[index * 4 + 3] = body.quaternion.w;
        });

        self.postMessage({
            operation: 'update_frame',
            count: bodies.length,
            positions,
            quaternions
        }, [positions.buffer, quaternions.buffer]);
    }
    if (message.data.operation === 'add_sphere') {
        const { position, radius } = message.data;
        const shape = new CANNON.Sphere(radius)
        const body = new CANNON.Body({
            mass: 1,
            shape
        });
        body.position.copy(position);
        world.addBody(body);
        bodies.push(body);
    }
    if (message.data.operation === 'add_box') {
        const { position, width, height, depth } = message.data;
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2))
        const body = new CANNON.Body({
            mass: 1,
            shape,
        });
        body.position.copy(position);
        world.addBody(body);
        bodies.push(body);
    }
    if (message.data.operation === 'reset') {
        bodies.forEach(body => {
            world.removeBody(body);
        });
        bodies.length = 0;
    }
}
