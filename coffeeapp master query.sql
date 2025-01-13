SELECT 
    log.roast_id,
    profile.batch_name,
    profile.oz_in,
    profile.oz_out,
    log.log_id,
    log.roast_id,
    log.fan_setting,
    log.heat_setting,
    log.start,
    log.maillard,
    log.fc_start,
    log.fc_rolling,
    log.fc_end,
    log.sc_start,
    log.drop,
    log.end,
    log.time
FROM
    coffeeapp.roast_profiles profile
        LEFT JOIN
    coffeeapp.profile_log log ON profile.roast_id = log.roast_id
WHERE 1 = 1
-- AND batch_name = 'hello'
        AND log.roast_id >180
        
