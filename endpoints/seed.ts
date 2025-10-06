import axios from "axios";



export const randomUser = async () => {
    // GET https://randomuser.me/api/
    return (await axios.get('https://randomuser.me/api')).data;
}

export const registerNewUser = async (
    name: string,
    email: string,
    password: string
) => {
    await axios.post(
        'http://localhost:3000/v1/user/register',
        { name, email, password }, {
            headers: {
                'content-type': 'application/json'
            }
        }
    );
};

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

for (let i = 0; i < 39; i++) {
    let rndUser = (await randomUser()).results[0];
    let passwd = rndUser.login.password + '123@A';
    if (passwd.length < 8) {
        while (passwd.length < 8) {
            passwd += 'X';
        }
    }
    console.log(`adding ${rndUser.login.username}:${passwd} to the recordList!`);
    await registerNewUser(rndUser.login.username, rndUser.email, passwd);
    await sleep(2000);
}
